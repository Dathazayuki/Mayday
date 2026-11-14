import {
  classifyAnswersFromState,
  describeError,
  stateToAnswerInputs,
  validateFormState,
  type AnswerValue,
  type ClassifyQuestion,
  type FormState,
  type TemplateDetailData,
} from '@drmayday/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, Text } from 'react-native';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { DynamicForm } from '@/components/dynamic-form/dynamic-form';
import { QuestionField } from '@/components/dynamic-form/question-field';
import { FormScreen } from '@/components/form-screen';
import { PrimaryButton } from '@/components/primary-button';
import { classifyToQuestion, visiblePatientQuestions } from '@/lib/dynamic-form';
import {
  classify,
  createMedicalRecord,
  fetchClassifyQuestions,
  fetchTemplate,
} from '@/lib/medical-records-api';

interface ClassifyStepProps {
  state: FormState;
  onStateChange: (state: FormState) => void;
  onClassified: (template: TemplateDetailData) => void;
}

/** Bước 1: trả lời câu hỏi phân loại để chọn mẫu phiếu. */
function ClassifyStep({ state, onStateChange, onClassified }: ClassifyStepProps) {
  const [questions, setQuestions] = useState<ClassifyQuestion[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setFormError(null);
    try {
      setQuestions(await fetchClassifyQuestions());
    } catch (error) {
      setFormError(describeError(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!questions) {
    return formError ? (
      <>
        <Banner tone="error" message={formError} />
        <PrimaryButton title="Thử lại" variant="secondary" onPress={() => void load()} />
      </>
    ) : (
      <ActivityIndicator size="large" />
    );
  }

  if (questions.length === 0) {
    return <Banner tone="error" message="Phòng khám chưa cấu hình câu hỏi phân loại." />;
  }

  const formQuestions = questions.map(classifyToQuestion);

  async function handleNext() {
    if (!questions) return;
    const nextErrors = validateFormState(formQuestions, state);
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const { template_id } = await classify({
        answers: classifyAnswersFromState(questions, state),
      });
      onClassified(await fetchTemplate(template_id));
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Text style={styles.intro}>Vui lòng trả lời vài câu hỏi để chọn phiếu khám phù hợp.</Text>
      {formError && <Banner tone="error" message={formError} />}
      {formQuestions.map((question) => (
        <QuestionField
          key={question.question_id}
          question={question}
          value={state[question.question_id]}
          error={errors[question.question_id]}
          onChange={(value) => onStateChange({ ...state, [question.question_id]: value })}
        />
      ))}
      <PrimaryButton title="Tiếp tục" onPress={() => void handleNext()} loading={submitting} />
    </>
  );
}

/** Bước 2: điền các section dành cho bệnh nhân rồi gửi bệnh án. */
function TemplateStep({ template, onBack }: { template: TemplateDetailData; onBack: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setAnswer = (questionId: string, value: AnswerValue) =>
    setState((current) => ({ ...current, [questionId]: value }));

  async function handleSubmit() {
    const visible = visiblePatientQuestions(template, state);
    const nextErrors = validateFormState(visible, state);
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const created = await createMedicalRecord({
        template_id: template.code_template,
        answers: stateToAnswerInputs(visible, state),
      });
      router.replace({
        pathname: '/records/[id]',
        params: { id: String(created.medical_record_id) },
      });
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Text style={styles.templateName}>{template.name}</Text>
      {formError && <Banner tone="error" message={formError} />}
      <DynamicForm template={template} state={state} errors={errors} onChange={setAnswer} />
      <PrimaryButton title="Gửi bệnh án" onPress={() => void handleSubmit()} loading={submitting} />
      <PrimaryButton title="Quay lại" variant="secondary" onPress={onBack} />
    </>
  );
}

function NewRecordFlow() {
  const [template, setTemplate] = useState<TemplateDetailData | null>(null);
  const [classifyState, setClassifyState] = useState<FormState>({});

  // Nút Back của Android ở bước 2 quay về bước 1 thay vì thoát khỏi màn hình.
  useEffect(() => {
    if (!template) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setTemplate(null);
      return true;
    });
    return () => subscription.remove();
  }, [template]);

  return (
    <FormScreen>
      {template ? (
        <TemplateStep template={template} onBack={() => setTemplate(null)} />
      ) : (
        <ClassifyStep
          state={classifyState}
          onStateChange={setClassifyState}
          onClassified={setTemplate}
        />
      )}
    </FormScreen>
  );
}

export default function NewRecordScreen() {
  return (
    <AuthGate require="signed-in">
      <NewRecordFlow />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 18 },
  templateName: { fontSize: 20, fontWeight: '700' },
});
