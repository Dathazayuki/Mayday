import type { OptionData } from '@drmayday/shared';
import { Space, Typography } from 'antd';
import { useAnswerImages } from '../../clinical/media-api';
import { QueryErrorAlert } from '../crud/QueryErrorAlert';
import { AuthorizedImage } from '../media/AuthorizedImage';

function AnswerImageList({ answerId, options }: { answerId: number; options: OptionData[] }) {
  const { data, error } = useAnswerImages(answerId);
  const optionLabels = new Map(options.map((o) => [o.option_value, o.option_text]));

  return (
    <>
      <QueryErrorAlert error={error} />
      {data && data.length > 0 && (
        <Space wrap align="start" style={{ marginTop: 8 }}>
          {data.map((item) => (
            <figure key={item.id} style={{ margin: 0 }}>
              <AuthorizedImage fileUrl={item.attachment.file_url} alt={item.attachment.file_name} />
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
      )}
    </>
  );
}

/** Ảnh đã gắn với câu trả lời (chỉ xem). Câu chưa có câu trả lời thì chưa có ảnh nên không gọi API. */
export function AnswerImages({
  answerId,
  options,
}: {
  answerId: number | undefined;
  options: OptionData[];
}) {
  if (answerId === undefined) return null;
  return <AnswerImageList answerId={answerId} options={options} />;
}
