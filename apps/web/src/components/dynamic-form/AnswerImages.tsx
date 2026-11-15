import type { OptionData } from '@drmayday/shared';
import { Space, Typography } from 'antd';
import { useAnswerImages } from '../../clinical/media-api';
import { QueryErrorAlert } from '../crud/QueryErrorAlert';
import { AuthorizedImage } from '../media/AuthorizedImage';

function AnswerImageList({
  answerId,
  options,
  labelledBy,
}: {
  answerId: number;
  options: OptionData[];
  labelledBy: string;
}) {
  const { data, error } = useAnswerImages(answerId);
  const optionLabels = new Map(options.map((o) => [o.option_value, o.option_text]));

  return (
    <>
      <QueryErrorAlert error={error} />
      {data && data.length > 0 && (
        <div role="group" aria-labelledby={labelledBy} style={{ marginTop: 8 }}>
          <Space wrap align="start">
            {data.map((item) => (
              <figure key={item.id} style={{ margin: 0 }}>
                <AuthorizedImage
                  fileUrl={item.attachment.file_url}
                  alt={item.attachment.file_name}
                />
                {item.option_value && (
                  <figcaption>
                    <Typography.Text type="secondary">
                      {optionLabels.get(item.option_value) ?? item.option_value}
                    </Typography.Text>
                  </figcaption>
                )}
              </figure>
            ))}
          </Space>
        </div>
      )}
    </>
  );
}

/** Ảnh đã gắn với câu trả lời (chỉ xem). Câu chưa có câu trả lời thì chưa có ảnh nên không gọi API. */
export function AnswerImages({
  answerId,
  options,
  labelledBy,
}: {
  answerId: number | undefined;
  options: OptionData[];
  /** id của nhãn câu hỏi, đặt tên cho vùng ảnh. */
  labelledBy: string;
}) {
  if (answerId === undefined) return null;
  return <AnswerImageList answerId={answerId} options={options} labelledBy={labelledBy} />;
}
