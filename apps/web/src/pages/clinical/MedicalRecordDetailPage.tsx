import {
  answersToState,
  collectVisibleQuestions,
  describeError,
  stateToAnswerInputs,
  type AnswerData,
  type FormState,
  type MedicalRecordData,
  type TemplateDetailData,
} from '@drmayday/shared';
import { Alert, Button, Descriptions, Form, Input, Modal, Popconfirm, Skeleton, Space } from 'antd';
import { useState } from 'react';
import { useParams } from 'react-router';
import {
  useAcceptMedicalRecord,
  useCancelMedicalRecord,
  useCloseMedicalRecord,
  useMedicalRecord,
  useMedicalRecordAnswers,
  useMedicalRecordSummary,
  usePatientHistory,
  useSaveAnswers,
} from '../../clinical/medical-records-api';
import { canExamine } from '../../clinical/record-state';
import { MedicalRecordStatusTag } from '../../clinical/status';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { ItemList } from '../../components/ItemList';
import { useRunAction } from '../../components/crud/use-run-action';
import { DynamicForm } from '../../components/dynamic-form/DynamicForm';
import { Page } from '../../layout/Page';
import { Panel } from '../../layout/Panel';
import { formatDateTime } from '../../lib/format-date';
import { useTemplateDetail } from '../../templates/template-detail-api';
import { LabPanel } from './LabPanel';
import { LesionPanel } from './LesionPanel';
import { PrescriptionPanel } from './PrescriptionPanel';
import { Uas7Panel } from './Uas7Panel';

function SummaryCard({ record }: { record: MedicalRecordData }) {
  const { data, error } = useMedicalRecordSummary(record.medical_record_id);
  return (
    <Panel title="Thông tin bệnh án">
      <QueryErrorAlert error={error} />
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Bệnh nhân">{data?.patient_name}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái">
          <MedicalRecordStatusTag status={record.status} />
        </Descriptions.Item>
        <Descriptions.Item label="Ngày tạo">{formatDateTime(record.created_at)}</Descriptions.Item>
        {record.instructions && (
          <Descriptions.Item label="Dặn dò">{record.instructions}</Descriptions.Item>
        )}
      </Descriptions>
    </Panel>
  );
}

function HistoryCard({ patientId }: { patientId: number }) {
  const { data, error, isPending } = usePatientHistory(patientId);
  return (
    <Panel title="Lịch sử bệnh án của bệnh nhân">
      <QueryErrorAlert error={error} />
      <ItemList
        loading={isPending}
        items={data ?? []}
        rowKey={(item) => item.medical_record_id}
        emptyText="Chưa có bệnh án nào"
        renderItem={(item) => (
          <Space orientation="vertical" size={0}>
            <Space>
              <span className="num">#{item.medical_record_id}</span>
              <MedicalRecordStatusTag status={item.status} />
              <span>{formatDateTime(item.created_at)}</span>
            </Space>
            {item.instructions && <span>{item.instructions}</span>}
          </Space>
        )}
      />
    </Panel>
  );
}

function CloseModal({
  open,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (instructions: string) => void;
}) {
  const [form] = Form.useForm<{ instructions?: string }>();
  return (
    <Modal
      title="Chốt bệnh án"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Chốt"
      cancelText="Đóng"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={({ instructions }) => onSubmit(instructions?.trim() ?? '')}
      >
        <Form.Item
          label="Dặn dò"
          name="instructions"
          extra="Hiển thị trực tiếp cho bệnh nhân trên app"
        >
          <Input.TextArea rows={4} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** Phiếu khám và các nút thao tác của một bệnh án (khởi tạo trạng thái form từ câu trả lời đã lưu). */
function ExamPanel({
  record,
  template,
  answers,
}: {
  record: MedicalRecordData;
  template: TemplateDetailData;
  answers: AnswerData[];
}) {
  const id = record.medical_record_id;
  const allQuestions = template.sections.flatMap((s) => s.questions);
  // Trạng thái form chỉ khởi tạo một lần từ câu trả lời đã lưu; refetch sau đó không ghi đè phần đang nhập.
  const [state, setState] = useState<FormState>(() => answersToState(allQuestions, answers));
  const answerIdByQuestion = Object.fromEntries(answers.map((a) => [a.question_id, a.id]));
  const [closing, setClosing] = useState(false);
  const run = useRunAction();
  const accept = useAcceptMedicalRecord();
  const save = useSaveAnswers();
  const close = useCloseMedicalRecord();
  const cancel = useCancelMedicalRecord();

  const finished = record.status === 'completed' || record.status === 'cancelled';

  async function handleClose(instructions: string) {
    const ok = await run(
      () => close.mutateAsync({ id, status: 'completed', instructions }),
      'Đã chốt bệnh án',
    );
    if (ok) setClosing(false);
  }

  return (
    <Panel title={template.name}>
      {!finished && (
        <Space>
          {record.status === 'pending' && (
            <Button
              type="primary"
              loading={accept.isPending}
              onClick={() => void run(() => accept.mutateAsync(id), 'Đã tiếp nhận bệnh án')}
            >
              Tiếp nhận
            </Button>
          )}
          <Button
            loading={save.isPending}
            onClick={() =>
              void run(
                () =>
                  save.mutateAsync({
                    id,
                    answers: stateToAnswerInputs(
                      collectVisibleQuestions(allQuestions, state),
                      state,
                    ),
                  }),
                'Đã lưu câu trả lời',
              )
            }
          >
            Lưu câu trả lời
          </Button>
          {canExamine(record) && (
            <Button type="primary" onClick={() => setClosing(true)}>
              Chốt bệnh án
            </Button>
          )}
          <Popconfirm
            title="Huỷ bệnh án này?"
            okText="Đồng ý"
            cancelText="Không"
            onConfirm={() => void run(() => cancel.mutateAsync(id), 'Đã huỷ bệnh án')}
          >
            <Button danger loading={cancel.isPending}>
              Huỷ bệnh án
            </Button>
          </Popconfirm>
        </Space>
      )}
      {/* Nhân viên có quyền khám được điền mọi section (spec 3): không giới hạn theo filled_by. */}
      <DynamicForm
        template={template}
        value={state}
        onChange={setState}
        readOnly={finished}
        answerIdByQuestion={answerIdByQuestion}
      />
      <CloseModal
        open={closing}
        saving={close.isPending}
        onClose={() => setClosing(false)}
        onSubmit={(instructions) => void handleClose(instructions)}
      />
    </Panel>
  );
}

function RecordBody({ record }: { record: MedicalRecordData }) {
  const template = useTemplateDetail(record.template_id);
  const answers = useMedicalRecordAnswers(record.medical_record_id);
  const error = template.error ?? answers.error;

  return (
    <>
      <SummaryCard record={record} />
      <HistoryCard patientId={record.patient_id} />
      <Uas7Panel patientId={record.patient_id} />
      <PrescriptionPanel record={record} />
      <LabPanel record={record} />
      <LesionPanel medicalRecordId={record.medical_record_id} />
      <QueryErrorAlert error={error} />
      {record.template_id === null && (
        <Alert type="info" showIcon title="Bệnh án chưa gắn mẫu phiếu" />
      )}
      {record.template_id !== null && !error && (!template.data || !answers.data) && (
        <Skeleton active />
      )}
      {template.data && answers.data && (
        <ExamPanel record={record} template={template.data} answers={answers.data} />
      )}
    </>
  );
}

/** Màn khám: tóm tắt, lịch sử, điểm UAS7 và tổn thương da của bệnh nhân, phiếu khám (DynamicForm) và các nút tiếp nhận/chốt/huỷ. */
export function MedicalRecordDetailPage() {
  const id = Number(useParams().id);
  const { data, error, isPending } = useMedicalRecord(id);

  const title = `Bệnh án #${id}`;
  const back = { to: '/medical-records', label: 'Bệnh án' };

  if (error) {
    return (
      <Page title={title} back={back}>
        <Alert type="error" showIcon title={describeError(error)} />
      </Page>
    );
  }
  if (isPending) {
    return (
      <Page title={title} back={back}>
        <Skeleton active />
      </Page>
    );
  }
  return (
    <Page title={title} back={back}>
      <RecordBody record={data} />
    </Page>
  );
}
