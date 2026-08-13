import { formatBirthTime } from './format'
import { supabase } from './supabaseClient'

const PROFILE_COLUMNS = 'id, name, birth_date, birth_time, gender, calendar'

export async function fetchProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function upsertProfile(userId, { name, birthDate, birthTime, gender, calendar }) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      name: name.trim(),
      birth_date: birthDate,
      birth_time: birthTime,
      gender,
      calendar,
      updated_at: new Date().toISOString(),
    })
    .select(PROFILE_COLUMNS)
    .single()

  if (error) throw error
  return data
}

export function isSameAsProfile(profile, fields) {
  if (!profile) return false
  return (
    fields.name.trim() === (profile.name ?? '').trim() &&
    fields.birthDate === (profile.birth_date ?? '') &&
    formatBirthTime(fields.birthTime) === formatBirthTime(profile.birth_time) &&
    fields.gender === (profile.gender ?? '') &&
    fields.calendar === (profile.calendar ?? 'solar')
  )
}

export function shouldUpdateProfile(profile, nameValue) {
  if (!profile?.name) return true
  return nameValue.trim() === profile.name.trim()
}

export function profileFromReading(userId, reading) {
  if (!reading) return null
  return {
    id: userId,
    name: reading.name,
    birth_date: reading.birth_date,
    birth_time: reading.birth_time,
    gender: reading.gender,
    calendar: reading.calendar,
  }
}
