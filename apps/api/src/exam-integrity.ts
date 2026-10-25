import {richSchema} from './rich-schema';
/**
 * Deterministic content digest for an exam version. Hashes both the student
 * snapshot and private marking data without exposing the private data.
 * Inputs must come from trusted D1 rows, ordered by position.
 */
export type ExamDigestItem = {
  position: number;
  questionSnapshotJson: string;
  answerKeyPrivateJson: string;
};

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort().map(key =>
    JSON.stringify(key) + ':' + canonicalJson(record[key])
  ).join(',') + '}';
};

export async function examContentHash(items: ExamDigestItem[]): Promise<string> {
  if (items.length === 0 || items.length > 1000) throw new Error('INVALID_ITEM_COUNT');
  const ordered = [...items].sort((a,b) => a.position-b.position);
  ordered.forEach((item,index) => {
    if (item.position !== index) throw new Error('NON_CONTIGUOUS_POSITIONS');
    const question = JSON.parse(item.questionSnapshotJson) as Record<string, unknown>;
    const answer = JSON.parse(item.answerKeyPrivateJson) as Record<string, unknown>;
    if (typeof question.body !== 'string' || question.body.length < 5 ||
        !Array.isArray(question.options) || question.options.length !== 4 ||
        question.options.some((option,i) =>
          !option || option.label !== ['A','B','C','D'][i] ||
          typeof option.text !== 'string' || !option.text.trim()) ||
        !['A','B','C','D'].includes(String(answer.correctOption)) ||
        'correctOption' in question || 'explanation' in question || (question.richContent!==undefined&&!richSchema.safeParse(question.richContent).success)) {
      throw new Error('INVALID_ITEM_SNAPSHOT');
    }
  });
  const payload = canonicalJson(ordered.map(item => ({
    position:item.position,
    question:JSON.parse(item.questionSnapshotJson),
    answer:JSON.parse(item.answerKeyPrivateJson)
  })));
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}

