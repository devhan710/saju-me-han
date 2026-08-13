import { supabase } from './supabaseClient'

const READING_COLUMNS =
  'id, name, birth_date, birth_time, gender, calendar, result_kind, result_title, result_text, chart, created_at'

export async function fetchReadings() {
  const { data, error } = await supabase
    .from('saju_readings')
    .select(READING_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function createReading(payload, userId) {
  const { data, error } = await supabase
    .from('saju_readings')
    .insert({ ...payload, user_id: userId })
    .select(READING_COLUMNS)
    .single()

  if (error) throw error
  return data
}

export async function updateReading(id, payload) {
  const { data, error } = await supabase
    .from('saju_readings')
    .update(payload)
    .eq('id', id)
    .select(READING_COLUMNS)
    .single()

  if (error) throw error
  return data
}

export async function deleteReading(id) {
  const { error } = await supabase.from('saju_readings').delete().eq('id', id)
  if (error) throw error
}

export function buildReadingPayload({
  name,
  birthDate,
  birthTime,
  gender,
  calendar,
  kind,
  resultText,
  chart,
}) {
  return {
    name: name.trim(),
    birth_date: birthDate,
    birth_time: birthTime,
    gender,
    calendar,
    result_kind: kind,
    result_title: kind === 'love' ? '연애운' : '사주 해석',
    result_text: resultText,
    chart,
  }
}

export function buildMetadataPayload({
  name,
  birthDate,
  birthTime,
  gender,
  calendar,
  chart,
}) {
  return {
    name: name.trim(),
    birth_date: birthDate,
    birth_time: birthTime,
    gender,
    calendar,
    chart,
  }
}
