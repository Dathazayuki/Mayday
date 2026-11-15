import {
  buildQuestionTree,
  type QuestionData,
  type QuestionNode,
  type TemplateSectionDetail,
} from '@drmayday/shared';
import { Button, Collapse, Empty, Space } from 'antd';
import { useState } from 'react';
import { RowActions } from '../../../admin/RowActions';
import { StatusBadge } from '../../../theme/StatusBadge';
import { FILLED_BY_LABELS, QUESTION_TYPE_LABELS } from './template-labels';

interface SectionListProps {
  sections: TemplateSectionDetail[];
  onEditSection: (section: TemplateSectionDetail) => void;
  onDeleteSection: (section: TemplateSectionDetail) => void;
  onAddQuestion: (section: TemplateSectionDetail) => void;
  onEditQuestion: (question: QuestionData) => void;
  onDeleteQuestion: (question: QuestionData) => void;
}

type QuestionHandlers = Pick<SectionListProps, 'onEditQuestion' | 'onDeleteQuestion'>;

/** Câu hỏi con chỉ hiện khi câu trả lời của câu hỏi cha khớp: ghi rõ điều kiện ngay dưới câu hỏi. */
function conditionText(question: QuestionData, byId: ReadonlyMap<string, QuestionData>) {
  if (!question.parent_question_id || !question.show_if_answer) return null;
  const parent = byId.get(question.parent_question_id);
  return `Hiện khi "${parent?.question_text ?? question.parent_question_id}" là ${question.show_if_answer.join(', ')}`;
}

function QuestionTree({
  nodes,
  depth,
  byId,
  onEditQuestion,
  onDeleteQuestion,
}: QuestionHandlers & {
  nodes: QuestionNode[];
  depth: number;
  byId: ReadonlyMap<string, QuestionData>;
}) {
  return nodes.map(({ question, children }) => {
    const condition = conditionText(question, byId);
    return (
      <div key={question.question_id}>
        <div
          data-question-id={question.question_id}
          data-depth={depth}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 0',
            borderBottom: '1px solid var(--dm-line)',
          }}
        >
          <div>
            <div>
              <strong>{question.question_text}</strong>{' '}
              <Space size={6} wrap>
                <StatusBadge tone="neutral">{question.question_id}</StatusBadge>
                <StatusBadge tone="primary">
                  {QUESTION_TYPE_LABELS[question.type_question]}
                </StatusBadge>
                {question.is_required === '1' && <StatusBadge tone="red">Bắt buộc</StatusBadge>}
              </Space>
            </div>
            {condition && <div style={{ color: 'var(--dm-ink3)' }}>{condition}</div>}
          </div>
          <RowActions
            onEdit={() => onEditQuestion(question)}
            onDelete={() => onDeleteQuestion(question)}
          />
        </div>
        {children.length > 0 && (
          <div
            style={{
              marginLeft: 24,
              paddingLeft: 12,
              borderLeft: '2px solid var(--dm-line)',
            }}
          >
            <QuestionTree
              nodes={children}
              depth={depth + 1}
              byId={byId}
              onEditQuestion={onEditQuestion}
              onDeleteQuestion={onDeleteQuestion}
            />
          </div>
        )}
      </div>
    );
  });
}

/** Các section theo thứ tự (Collapse), mỗi section hiển thị câu hỏi dạng cây theo parent_question_id. */
export function SectionList({
  sections,
  onEditSection,
  onDeleteSection,
  onAddQuestion,
  ...questionHandlers
}: SectionListProps) {
  // Section nào người dùng đã thu gọn; section mới thêm mặc định mở.
  const [collapsed, setCollapsed] = useState<string[]>([]);
  // Câu hỏi cha có thể nằm ở section khác của cùng mẫu phiếu.
  const byId = new Map(sections.flatMap((s) => s.questions).map((q) => [q.question_id, q]));

  if (sections.length === 0) return <Empty description="Mẫu phiếu chưa có section nào" />;

  return (
    <Collapse
      activeKey={sections.map((s) => s.section_id).filter((id) => !collapsed.includes(id))}
      onChange={(open) => {
        const openKeys = [open].flat();
        setCollapsed(sections.map((s) => s.section_id).filter((id) => !openKeys.includes(id)));
      }}
      items={sections.map((section) => ({
        key: section.section_id,
        label: (
          <Space wrap>
            <span>{section.title}</span>
            {section.is_required === '1' && <StatusBadge tone="red">Bắt buộc</StatusBadge>}
            {section.filled_by && (
              <StatusBadge tone="neutral">{FILLED_BY_LABELS[section.filled_by]}</StatusBadge>
            )}
          </Space>
        ),
        extra: (
          // Bấm nút không được thu gọn/mở section (sự kiện của Popconfirm cũng nổi bọt qua đây).
          <span onClick={(event) => event.stopPropagation()}>
            <RowActions
              extra={
                <Button size="small" type="primary" onClick={() => onAddQuestion(section)}>
                  Thêm câu hỏi
                </Button>
              }
              onEdit={() => onEditSection(section)}
              onDelete={() => onDeleteSection(section)}
            />
          </span>
        ),
        children:
          section.questions.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có câu hỏi" />
          ) : (
            <QuestionTree
              nodes={buildQuestionTree(section.questions)}
              depth={0}
              byId={byId}
              {...questionHandlers}
            />
          ),
      }))}
    />
  );
}
