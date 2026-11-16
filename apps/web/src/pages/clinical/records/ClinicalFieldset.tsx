import { CLINICAL_GROUP_LABELS, type ClinicalField } from '@drmayday/shared';
import { AutoComplete, DatePicker, Form, Input, InputNumber, Segmented, Select } from 'antd';
import type { Rule } from 'antd/es/form';
import type { ReactElement } from 'react';
import {
  BOOL_CHOICES,
  clinicalSections,
  detailVisible,
  fieldName,
  flagFieldOf,
  fromFormValue,
  type ClinicalBlock,
  withinPlaces,
} from '../../../clinical/clinical-form';
import { DurationInput } from './DurationInput';

/**
 * Ô nhập theo kiểu của bộ mô tả (spec B, mục 8.7). Trả thẳng phần tử của antd (không bọc component) để
 * Form.Item gắn `id`, `value`, `onChange` vào đúng ô.
 */
function clinicalInput(field: ClinicalField): ReactElement {
  switch (field.type) {
    case 'bool':
      return <Segmented aria-label={field.label} options={[...BOOL_CHOICES]} />;
    case 'enum':
      return <Select allowClear placeholder="Chưa nhập" options={[...field.options]} />;
    case 'text':
      return <Input.TextArea autoSize={{ minRows: 1, maxRows: 6 }} maxLength={field.maxLength} />;
    case 'suggest':
      // Gợi ý theo docs/04, vẫn gõ tự do được (MT-125 a).
      return (
        <AutoComplete
          allowClear
          maxLength={field.maxLength}
          options={field.suggestions.map((suggestion) => ({ value: suggestion }))}
          showSearch={{
            filterOption: (input, option) =>
              String(option?.value ?? '')
                .toLowerCase()
                .includes(input.toLowerCase()),
          }}
        />
      );
    case 'int':
      return (
        <InputNumber min={field.min} max={field.max} precision={0} style={{ width: '100%' }} />
      );
    case 'decimal':
      return (
        <InputNumber
          min={field.min}
          max={field.max}
          step={10 ** -field.places}
          decimalSeparator=","
          style={{ width: '100%' }}
        />
      );
    case 'date':
      return <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />;
    case 'datetime':
      return <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />;
    case 'duration':
      return <DurationInput label={field.label} />;
  }
}

/** Luật của ô: số thập phân không quá `places` chữ số (cột NUMERIC của CSDL). */
function clinicalRules(field: ClinicalField): Rule[] {
  if (field.type !== 'decimal') return [];
  return [
    {
      validator: (_, value: unknown) =>
        typeof value !== 'number' || withinPlaces(value, field.places)
          ? Promise.resolve()
          : Promise.reject(new Error(`Tối đa ${field.places} chữ số thập phân`)),
    },
  ];
}

/**
 * Một ô của khối. Ô ghi rõ (`detailOf`) chỉ hiện khi cờ bật hoặc chọn "Có"; khi cờ tắt ô bị gỡ khỏi form
 * (`preserve={false}` của ClinicalForm) nên giá trị đã gõ trở về giá trị ban đầu của form, và ô ẩn không
 * bao giờ được gửi lên (D-B14: API tự ghi null khi cờ tắt).
 */
function ClinicalFormItem({ block, field }: { block: ClinicalBlock; field: ClinicalField }) {
  const item = (
    <Form.Item name={fieldName(block, field.key)} label={field.label} rules={clinicalRules(field)}>
      {clinicalInput(field)}
    </Form.Item>
  );
  const flag = flagFieldOf(field, block.fields);
  if (flag === null) return item;
  const flagName = fieldName(block, flag.key);
  return (
    <Form.Item noStyle dependencies={[flagName]}>
      {({ getFieldValue }) =>
        detailVisible(field, fromFormValue(flag, getFieldValue(flagName))) ? item : null
      }
    </Form.Item>
  );
}

/**
 * Ô nhập dựng từ bộ mô tả trường lâm sàng (`ClinicalFieldset`, D-B13, spec B mục 8.7), nhóm theo phân
 * nhóm docs/04. Tiêu đề nhóm chỉ hiện khi form có từ hai nhóm trở lên.
 */
export function ClinicalFieldset({ blocks }: { blocks: readonly ClinicalBlock[] }) {
  const sections = clinicalSections(blocks);
  return sections.map((section) => (
    <section key={section.key} className="dm-clinical-group">
      {sections.length > 1 && (
        <h3 className="dm-clinical-group__title">{CLINICAL_GROUP_LABELS[section.group]}</h3>
      )}
      <div className="dm-clinical-grid">
        {section.fields.map((field) => (
          <ClinicalFormItem key={field.key} block={section.block} field={field} />
        ))}
      </div>
    </section>
  ));
}
