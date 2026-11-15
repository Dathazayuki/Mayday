import {
  describeMedication,
  formatDisplayLesionDateTime,
  groupPhotosByMilestone,
  LESION_MILESTONE_LABELS,
  LESION_MILESTONES,
  parseContextTags,
  SYMPTOM_SCORE_FIELDS,
  SYMPTOM_SCORE_LABELS,
  SYMPTOM_SCORE_MAX,
  type LesionPhotoListItem,
  type RecordLesionEpisodeItem,
} from '@drmayday/shared';
import { Button, Card, Col, Descriptions, Row, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import {
  useEpisodeLocations,
  useLesionEpisode,
  useLocationPhotos,
  useRecordLesionEpisodes,
} from '../../clinical/lesions-api';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { ItemList } from '../../components/ItemList';
import { AuthorizedImage } from '../../components/media/AuthorizedImage';
import { Panel } from '../../layout/Panel';

const HTTP_URL = /^https?:\/\//i;

/** "Ngứa 5/10 · Đau 3/10 · Rát –": điểm chưa chấm hiện "–". */
function describeScores(photo: LesionPhotoListItem): string {
  return SYMPTOM_SCORE_FIELDS.map((field) => {
    const score = photo[field];
    return `${SYMPTOM_SCORE_LABELS[field]} ${score === null ? '–' : `${score}/${SYMPTOM_SCORE_MAX}`}`;
  }).join(' · ');
}

function PhotoCard({ photo }: { photo: LesionPhotoListItem }) {
  return (
    <Space orientation="vertical" size={2} style={{ marginBottom: 12 }}>
      <AuthorizedImage
        fileUrl={photo.attachment.file_url}
        alt={`Ảnh tổn thương ${LESION_MILESTONE_LABELS[photo.milestone]}`}
        width={120}
        height={120}
      />
      {photo.taken_at && <span>{formatDisplayLesionDateTime(photo.taken_at)}</span>}
      <span>{describeScores(photo)}</span>
      {photo.hives_count !== null && <span className="num">Số nốt sẩn: {photo.hives_count}</span>}
      {photo.local_auas !== null && <span>AUAS cục bộ: {photo.local_auas}</span>}
      {photo.annotated_url && HTTP_URL.test(photo.annotated_url) && (
        <a href={photo.annotated_url} target="_blank" rel="noopener noreferrer">
          Ảnh đánh dấu
        </a>
      )}
    </Space>
  );
}

/** Ảnh của một vị trí, chia ba cột theo mốc khởi phát / đỉnh điểm / hồi phục. */
function LocationPhotos({ locationId }: { locationId: string }) {
  const { data, error } = useLocationPhotos(locationId);
  const groups = groupPhotosByMilestone(data ?? []);
  return (
    <>
      <QueryErrorAlert error={error} />
      <Row gutter={16}>
        {LESION_MILESTONES.map((milestone) => (
          <Col key={milestone} span={8} data-testid={`milestone-${milestone}`}>
            <Typography.Text strong>{LESION_MILESTONE_LABELS[milestone]}</Typography.Text>
            <div style={{ marginTop: 8 }}>
              {groups[milestone].map((photo) => (
                <PhotoCard key={photo.photo_id} photo={photo} />
              ))}
            </div>
          </Col>
        ))}
      </Row>
    </>
  );
}

function EpisodeDetail({ episodeId }: { episodeId: string }) {
  const episode = useLesionEpisode(episodeId);
  const locations = useEpisodeLocations(episodeId);
  const medication = episode.data ? describeMedication(episode.data) : null;
  return (
    <div style={{ marginTop: 12 }}>
      <QueryErrorAlert error={episode.error} />
      <QueryErrorAlert error={locations.error} />
      {episode.data && (medication || episode.data.context_other) && (
        <Descriptions column={1} size="small" style={{ marginBottom: 12 }}>
          {episode.data.context_other && (
            <Descriptions.Item label="Bối cảnh khác">
              {episode.data.context_other}
            </Descriptions.Item>
          )}
          {medication && <Descriptions.Item label="Thuốc">{medication}</Descriptions.Item>}
        </Descriptions>
      )}
      {locations.data?.map((location) => (
        <Card
          key={location.lesion_location_id}
          size="small"
          title={location.body_part}
          style={{ marginBottom: 12 }}
        >
          <LocationPhotos locationId={location.lesion_location_id} />
        </Card>
      ))}
    </div>
  );
}

function EpisodeItem({ episode }: { episode: RecordLesionEpisodeItem }) {
  const [open, setOpen] = useState(false);
  const tags = (episode.context_tags && parseContextTags(episode.context_tags)) || [];
  return (
    <div style={{ flex: 1 }}>
      <Space wrap>
        <strong>{episode.name}</strong>
        {episode.occurred_at && <span>{formatDisplayLesionDateTime(episode.occurred_at)}</span>}
        {tags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
        <Button size="small" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Thu gọn' : 'Xem chi tiết'}
        </Button>
      </Space>
      {episode.description && <div>{episode.description}</div>}
      {open && <EpisodeDetail episodeId={episode.id} />}
    </div>
  );
}

/** Các đợt tổn thương da của bệnh án do bệnh nhân ghi nhận (chỉ xem). */
export function LesionPanel({ medicalRecordId }: { medicalRecordId: number }) {
  const { data, error, isPending } = useRecordLesionEpisodes(medicalRecordId);
  return (
    <Panel title="Tổn thương da" style={{ marginBottom: 16 }}>
      <QueryErrorAlert error={error} />
      <ItemList
        loading={isPending}
        items={data ?? []}
        rowKey={(episode) => episode.id}
        emptyText="Bệnh nhân chưa ghi nhận đợt tổn thương nào"
        renderItem={(episode) => <EpisodeItem episode={episode} />}
      />
    </Panel>
  );
}
