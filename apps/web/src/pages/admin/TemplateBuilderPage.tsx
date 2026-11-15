import type { TemplateSectionDetail } from '@drmayday/shared';
import { Button, Spin } from 'antd';
import { useState } from 'react';
import { useParams } from 'react-router';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { useDeleteQuestion, useDeleteSection } from '../../admin/templates-api';
import { useTemplateDetail } from '../../templates/template-detail-api';
import { useEntityModal } from '../../components/crud/use-entity-modal';
import { useDeleteAction } from '../../components/crud/use-run-action';
import { Page } from '../../layout/Page';
import { Panel } from '../../layout/Panel';
import { FormPreview } from './templates/FormPreview';
import { nextOrder } from './templates/mapping';
import { QuestionDrawer } from './templates/QuestionDrawer';
import { useQuestionDrawerState } from './templates/question-drawer-state';
import { SectionFormModal } from './templates/SectionFormModal';
import { SectionList } from './templates/SectionList';
import { toSectionFormValues, type SectionFormValues } from './templates/section-payload';

/** Trình thiết kế mẫu phiếu (route /admin/templates/:code): section, câu hỏi dạng cây, xem trước. */
export function TemplateBuilderPage() {
  const { code = '' } = useParams();
  const { data: template, error, isPending } = useTemplateDetail(code);
  const [previewing, setPreviewing] = useState(false);

  const removeSection = useDeleteSection();
  const removeQuestion = useDeleteQuestion();
  const deleteSection = useDeleteAction('section');
  const deleteQuestion = useDeleteAction('câu hỏi');
  const sections = template?.sections ?? [];
  const sectionModal = useEntityModal<SectionFormValues, TemplateSectionDetail>((section) =>
    toSectionFormValues(section, nextOrder(sections)),
  );
  const questionDrawer = useQuestionDrawerState();

  const back = { to: '/admin/templates', label: 'Mẫu phiếu khám' };

  // Mọi nhánh đều qua Page để không mất thanh trên cùng; chưa có mẫu thì lấy mã từ URL làm tiêu đề.
  if (isPending) {
    return (
      <Page title={code} back={back}>
        <Spin size="large" style={{ display: 'block', margin: '64px auto' }} />
      </Page>
    );
  }

  return (
    <Page
      title={template?.name ?? code}
      subtitle={template && <span className="num">{template.code_template}</span>}
      back={back}
      actions={
        template && (
          <>
            <Button type="primary" onClick={sectionModal.openCreate}>
              Thêm section
            </Button>
            <Button onClick={() => setPreviewing(true)}>Xem trước</Button>
          </>
        )
      }
    >
      <QueryErrorAlert error={error} />
      {template && (
        <Panel>
          <SectionList
            sections={sections}
            onEditSection={sectionModal.openEdit}
            onDeleteSection={(section) =>
              deleteSection(() => removeSection.mutateAsync(section.section_id))
            }
            onAddQuestion={questionDrawer.openCreate}
            onEditQuestion={questionDrawer.openEdit}
            onDeleteQuestion={(question) =>
              deleteQuestion(() => removeQuestion.mutateAsync(question.question_id))
            }
          />
          <SectionFormModal modal={sectionModal} templateCode={template.code_template} />
          <QuestionDrawer drawer={questionDrawer} sections={sections} />
          <FormPreview template={template} open={previewing} onClose={() => setPreviewing(false)} />
        </Panel>
      )}
    </Page>
  );
}
