import {
  classifyAnswersFromState,
  collectImageSlots,
  countImagesByQuestion,
  describeError,
  imageAnswerPlaceholders,
  imageSlotKey,
  stateToAnswerInputs,
  validateFormState,
  validateImageQuestions,
  type AnswerValue,
  type ClassifyQuestion,
  type FormState,
  type PickedImages,
  type TemplateDetailData,
} from '@drmayday/shared';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, Text } from 'react-native';
import { useCurrentUserId } from '@/auth/auth-context';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { AnswerImagesField } from '@/components/dynamic-form/answer-images-field';
import { DynamicForm } from '@/components/dynamic-form/dynamic-form';
import { QuestionField } from '@/components/dynamic-form/question-field';
import { FormScreen } from '@/components/form-screen';
import { PrimaryButton } from '@/components/primary-button';
import { classifyToQuestion, visiblePatientQuestions } from '@/lib/dynamic-form';
import type { PickedImage } from '@/lib/image-picker';
import { uploadRecordImages } from '@/lib/record-images';
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
interface TemplateStepProps {
  template: TemplateDetailData;
  onBack: () => void;
  /** Báo màn cha khoá nút Back trong lúc đang gửi và tải ảnh. */
  onLockedChange: (locked: boolean) => void;
}

function TemplateStep({ template, onBack, onLockedChange }: TemplateStepProps) {
  const router = useRouter();
  const userId = useCurrentUserId();
  const [state, setState] = useState<FormState>({});
  const [picked, setPicked] = useState<PickedImages<PickedImage>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setAnswer = (questionId: string, value: AnswerValue) =>
    setState((current) => ({ ...current, [questionId]: value }));

  async function handleSubmit() {
    const visible = visiblePatientQuestions(template, state);
    const slots = collectImageSlots(visible, state, picked);
    const nextErrors = {
      ...validateFormState(visible, state),
      ...validateImageQuestions(visible, countImagesByQuestion(slots)),
    };
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    if (!userId) {
      setFormError('Không xác định được tài khoản. Vui lòng đăng nhập lại.');
      return;
    }

    setSubmitting(true);
    onLockedChange(true);
    try {
      // Câu có ảnh cần một bản ghi câu trả lời để có answer_id gắn ảnh (MT-93).
      const answers = stateToAnswerInputs(visible, state);
      const placeholders = imageAnswerPlaceholders(
        [...new Set(slots.map((slot) => slot.questionId))],
        answers,
      );
      const created = await createMedicalRecord({
        template_id: template.code_template,
        answers: [...answers, ...placeholders],
      });
      const recordId = String(created.medical_record_id);
      // Bệnh án đã tạo; ảnh lỗi thì vẫn mở chi tiết và báo ở đó.
      const imagesUploaded =
        slots.length === 0 ||
        (await uploadRecordImages({
          medicalRecordId: recordId,
          userId,
          slots,
          onProgress: (done, total) => setProgress({ done, total }),
        }));
      router.replace({
        pathname: '/records/[id]',
        params: imagesUploaded ? { id: recordId } : { id: recordId, imagesFailed: '1' },
      });
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
      setProgress(null);
      onLockedChange(false);
    }
  }

  return (
    <>
      <Text style={styles.templateName}>{template.name}</Text>
      {formError && <Banner tone="error" message={formError} />}
      <DynamicForm
        template={template}
        state={state}
        errors={errors}
        onChange={setAnswer}
        renderImages={({ question, optionValue, title }) => {
          const key = imageSlotKey(question.question_id, optionValue);
          return (
            <AnswerImagesField
              mode="local"
              title={title}
              images={picked[key] ?? []}
              onChange={(images) => setPicked((current) => ({ ...current, [key]: images }))}
            />
          );
        }}
      />
      {progress && (
        <Banner tone="success" message={`Đang tải ảnh ${progress.done}/${progress.total}...`} />
      )}
      <PrimaryButton title="Gửi bệnh án" onPress={() => void handleSubmit()} loading={submitting} />
      <PrimaryButton title="Quay lại" variant="secondary" onPress={onBack} disabled={submitting} />
    </>
  );
}

function NewRecordFlow() {
  const [template, setTemplate] = useState<TemplateDetailData | null>(null);
  const [classifyState, setClassifyState] = useState<FormState>({});
  const [locked, setLocked] = useState(false);

  // Nút Back của Android ở bước 2 quay về bước 1 thay vì thoát khỏi màn hình; đang gửi thì bị chặn.
  useEffect(() => {
    if (!template) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!locked) setTemplate(null);
      return true;
    });
    return () => subscription.remove();
  }, [template, locked]);

  return (
    <FormScreen>
      <Stack.Screen options={{ headerBackVisible: !locked, gestureEnabled: !locked }} />
      {template ? (
        <TemplateStep
          template={template}
          onBack={() => setTemplate(null)}
          onLockedChange={setLocked}
        />
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
