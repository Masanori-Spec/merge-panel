"""Independent MergePanel model and CSV inverse oracle (Python stdlib only).

Input: [{name, project, actual, csv?: ..., columns?: ...}].
No production compiler, CSV writer, or grouping helper is imported.
"""
from collections import Counter, OrderedDict
import csv
import io
import json
import re
import sys

BREAKS = re.compile(r'\r\n|[\r\n\u2028\u2029]')


def reference(project):
    settings = project['settings']
    source = project['table']['rows']
    capacity = settings['capacity']
    fields = [
        {'id': field['token'], 'column': field['column'],
         'header': project['table']['columns'][field['column']], 'kind': field['kind']}
        for field in settings['fields'] if field['enabled']
    ]
    grouped = OrderedDict()
    for row_number, row in enumerate(source, 1):
        identity = None if settings['group'] is None else row[settings['group']]
        grouped.setdefault(identity, []).append(row_number)
    groups = [{'id': f'g{i}', 'value': value, 'rows': rows} for i, (value, rows) in enumerate(grouped.items(), 1)]
    records, placements, changes, blocked = [], [], [], []
    for group in groups:
        count = (len(group['rows']) + capacity - 1) // capacity
        for group_record in range(count):
            ordinal = len(records) + 1
            record = {
                'id': f'r{ordinal:04}', 'ordinal': ordinal, 'groupId': group['id'],
                'groupValue': group['value'], 'groupRecord': group_record + 1,
                'groupRecords': count, 'occupied': min(capacity, len(group['rows']) - group_record * capacity), 'slots': [],
            }
            for slot_index in range(capacity):
                offset = group_record * capacity + slot_index
                if offset >= len(group['rows']):
                    record['slots'].append({'slot': slot_index + 1, 'present': False, 'row': None, 'itemId': None,
                                            'values': [''] * len(fields), 'originalValues': [None] * len(fields)})
                    continue
                number = group['rows'][offset]
                raw = source[number - 1]
                item_id = None if settings['id'] is None else raw[settings['id']]
                original = [raw[field['column']] for field in fields]
                values = []
                for field, value in zip(fields, original):
                    replacement = value
                    if settings['profile'] == 'indesign' and BREAKS.search(value):
                        if settings['multiline'] == 'block' or field['kind'] == 'image' or field['column'] in [settings['group'], settings['id']]:
                            kind = 'identity' if field['column'] in [settings['group'], settings['id']] else field['kind']
                            blocked.append({'row': number, 'column': field['column'], 'fieldId': field['id'], 'kind': kind, 'value': value})
                        else:
                            replacement = BREAKS.sub(' ', value)
                            changes.append({'row': number, 'column': field['column'], 'fieldId': field['id'],
                                            'original': value, 'replacement': replacement, 'breaks': len(BREAKS.findall(value))})
                    values.append(replacement)
                record['slots'].append({'slot': slot_index + 1, 'present': True, 'row': number, 'itemId': item_id,
                                        'values': values, 'originalValues': original})
                placements.append({'row': number, 'itemId': item_id, 'recordId': record['id'], 'record': ordinal,
                                   'slot': slot_index + 1, 'groupId': group['id'], 'groupValue': group['value'],
                                   'groupRecord': group_record + 1})
            records.append(record)
    if settings['profile'] == 'indesign':
        for number, raw in enumerate(source, 1):
            for role in ['group', 'id']:
                column = settings[role]
                if column is not None and BREAKS.search(raw[column]):
                    blocked.append({'row': number, 'column': column, 'fieldId': role, 'kind': 'identity', 'value': raw[column]})
    return {
        'schema': 'mergepanel.compiled.v1', 'title': project['title'], 'capacity': capacity,
        'profile': settings['profile'], 'multiline': settings['multiline'], 'inputRows': len(source),
        'fieldMap': fields, 'groups': groups, 'records': records, 'placements': placements,
        'changes': changes, 'blocked': blocked, 'mergeAllowed': not blocked,
        'regrouped': [item['row'] for item in placements] != list(range(1, len(source) + 1)),
        'padding': len(records) * capacity - len(source),
    }


def machine_rows(expected):
    headers = ['mp_layout_record', 'mp_grouped', 'mp_group_index', 'mp_group_label',
               'mp_group_chunk', 'mp_group_chunks', 'mp_slot_count']
    for slot in range(1, expected['capacity'] + 1):
        headers.extend([f'slot_{slot}_present', f'slot_{slot}_source_record', f'slot_{slot}_source_id'])
        headers.extend(('@' if field['kind'] == 'image' else '') + f'slot_{slot}_{field["id"]}' for field in expected['fieldMap'])
    rows = [headers]
    for record in expected['records']:
        cells = [str(record['ordinal']), '0' if record['groupValue'] is None else '1', record['groupId'][1:],
                 '' if record['groupValue'] is None else record['groupValue'], str(record['groupRecord']),
                 str(record['groupRecords']), str(record['occupied'])]
        for slot in record['slots']:
            cells.extend(['1' if slot['present'] else '0', '' if slot['row'] is None else str(slot['row']),
                          '' if slot['itemId'] is None else slot['itemId'], *slot['values']])
        rows.append(cells)
    return rows


def audit_exports(case, expected, errors):
    files = {entry['key']: entry for entry in case['files']}
    if len(files) != len(case['files']):
        errors.append('duplicate artifact keys')
    if ('merge' in files) != expected['mergeAllowed'] or ('review' in files) != expected['mergeAllowed']:
        errors.append('merge/review files must exist exactly when policy permits export')
    project = json.loads(files['project']['content'])
    if project != case['project']:
        errors.append('exported project loses or changes source/recipe values')
    placement = json.loads(files['placement-json']['content'])
    wanted_placement = {
        'schema': 'mergepanel.placement.v1', 'title': project['title'], 'settings': project['settings'],
        'sourceColumns': project['table']['columns'], 'fieldMap': expected['fieldMap'],
        'groups': expected['groups'], 'regrouped': expected['regrouped'],
        'records': expected['records'], 'placements': expected['placements'],
    }
    if placement != wanted_placement:
        errors.append('placement JSON differs from independent source-derived receipt')
    changes = json.loads(files['changes']['content'])
    wanted_changes = { 'schema': 'mergepanel.changes.v1', 'profile': expected['profile'],
                      'multiline': expected['multiline'], 'mergeAllowed': expected['mergeAllowed'],
                      'changes': expected['changes'], 'blocked': expected['blocked'] }
    if changes != wanted_changes:
        errors.append('change receipt JSON differs from exact replacement/block facts')
    expected_placements = [['source_record', 'source_id', 'id_present', 'layout_record', 'slot', 'group_index', 'group_value', 'grouping_enabled', 'group_chunk']]
    for entry in expected['placements']:
        expected_placements.append([str(entry['row']), '' if entry['itemId'] is None else entry['itemId'],
                                    'false' if entry['itemId'] is None else 'true', str(entry['record']), str(entry['slot']), entry['groupId'][1:],
                                    '' if entry['groupValue'] is None else entry['groupValue'], 'false' if entry['groupValue'] is None else 'true', str(entry['groupRecord'])])
    parsed_placements = list(csv.reader(io.StringIO(files['placements']['content'], newline='')))
    if parsed_placements != expected_placements:
        errors.append('placement CSV changes source identity or destination')
    if not expected['mergeAllowed']:
        return
    rows = list(csv.reader(io.StringIO(files['merge']['content'], newline='')))
    expected_csv = machine_rows(expected)
    if rows != expected_csv:
        errors.append('independently parsed machine CSV does not match grouped records')
    reviewed = list(csv.reader(io.StringIO(files['review']['content'], newline='')))
    guarded = [[("'" + value) if (re.match(r'^[\s\ufeff]*[=+@-]', value) or re.match(r'^[\t\r\n]', value)) else value
                for value in row] for row in expected_csv]
    if reviewed != guarded:
        errors.append('spreadsheet review differs from documented apostrophe guards')
    header = rows[0]
    if len(header) != len(set(header)):
        errors.append('generated CSV headers collide')
    by_record = {int(row[header.index('mp_layout_record')]): dict(zip(header, row)) for row in rows[1:]}
    receipts = {(entry['row'], entry['column']): entry for entry in changes['changes']}
    recovered = {}
    # Inverse: begin only with placement JSON and parsed machine CSV, then use
    # change receipts to restore selected original values, indexed by source row.
    for entry in placement['placements']:
        row_number, slot = entry['row'], entry['slot']
        record = by_record[entry['record']]
        if record[f'slot_{slot}_present'] != '1' or record[f'slot_{slot}_source_record'] != str(row_number):
            errors.append('placement inverse points to padding or the wrong source row')
        values = []
        for field in placement['fieldMap']:
            name = ('@' if field['kind'] == 'image' else '') + f'slot_{slot}_{field["id"]}'
            value = record[name]
            receipt = receipts.get((row_number, field['column']))
            if receipt is not None:
                if value != receipt['replacement']:
                    errors.append('replacement receipt does not match actual merge CSV')
                value = receipt['original']
            values.append(value)
        if row_number in recovered:
            errors.append('inverse reconstruction repeats a source row')
        recovered[row_number] = values
    desired = {number: [row[field['column']] for field in expected['fieldMap']]
               for number, row in enumerate(project['table']['rows'], 1)}
    if recovered != desired:
        errors.append('CSV inverse cannot recover exact selected source values')


def verify(case):
    expected = reference(case['project'])
    actual = case['actual']
    errors = []
    for key, value in expected.items():
        if actual.get(key) != value:
            errors.append(f'{key} differs from independent grouping/placement reference')
    source_rows = len(case['project']['table']['rows'])
    occupied = [slot for record in actual['records'] for slot in record['slots'] if slot['present']]
    if Counter(slot['row'] for slot in occupied) != Counter(range(1, source_rows + 1)):
        errors.append('each original row must occupy exactly one real slot')
    if Counter(item['row'] for item in actual['placements']) != Counter(range(1, source_rows + 1)):
        errors.append('each original row must have exactly one placement receipt')
    for record in actual['records']:
        if len(record['slots']) != expected['capacity']:
            errors.append('record capacity mismatch')
        if sum(slot['present'] for slot in record['slots']) != record['occupied']:
            errors.append('occupied count mismatch')
        if len({slot['slot'] for slot in record['slots']}) != expected['capacity']:
            errors.append('slot numbers repeat or disappear')
        for slot in record['slots']:
            if not slot['present'] and (slot['row'] is not None or slot['itemId'] is not None or any(slot['values']) or any(v is not None for v in slot['originalValues'])):
                errors.append('padding carries real-row identity or content')
    if 'files' in case:
        audit_exports(case, expected, errors)
    return {'name': case.get('name'), 'rows': source_rows, 'records': len(expected['records']),
            'padding': expected['padding'], 'errors': errors}


if __name__ == '__main__':
    results = []
    for case in json.load(sys.stdin):
        try:
            results.append(verify(case))
        except (KeyError, ValueError, TypeError, IndexError) as error:
            results.append({'name': case.get('name'), 'errors': [f'malformed compiled data: {type(error).__name__}: {error}']})
    json.dump(results, sys.stdout, ensure_ascii=True)
    sys.stdout.write('\n')
    sys.exit(1 if any(result['errors'] for result in results) else 0)
