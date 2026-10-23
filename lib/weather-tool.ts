// Live weather for the agent tool runtime, backed by Open-Meteo (no API key).
// Only these two fixed hosts are ever contacted; the model controls nothing but the place name.
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const MAX_LOCATION_LENGTH = 100;
const DEFAULT_DAYS = 3;
const MAX_DAYS = 7;
const ARG_FIELDS = new Set(['location', 'days']);

const CONDITIONS: Readonly<Record<number, string>> = Object.freeze({
  0: 'Açık',
  1: 'Çoğunlukla açık',
  2: 'Parçalı bulutlu',
  3: 'Kapalı',
  45: 'Sisli',
  48: 'Kırağı ile sisli',
  51: 'Hafif çisenti',
  53: 'Çisenti',
  55: 'Yoğun çisenti',
  56: 'Hafif donan çisenti',
  57: 'Donan çisenti',
  61: 'Hafif yağmurlu',
  63: 'Yağmurlu',
  65: 'Şiddetli yağmurlu',
  66: 'Hafif donan yağmur',
  67: 'Donan yağmur',
  71: 'Hafif kar yağışlı',
  73: 'Kar yağışlı',
  75: 'Yoğun kar yağışlı',
  77: 'Kar taneli',
  80: 'Hafif sağanak',
  81: 'Sağanak',
  82: 'Şiddetli sağanak',
  85: 'Hafif kar sağanağı',
  86: 'Yoğun kar sağanağı',
  95: 'Gök gürültülü fırtına',
  96: 'Hafif dolulu fırtına',
  99: 'Şiddetli dolulu fırtına'
});

export class WeatherToolError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = 'WeatherToolError';
    this.code = code;
    this.status = status;
  }
}

type FetchLike = (input: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface WeatherArgs {
  readonly location: string;
  readonly days: number;
}

export function normalizeWeatherArgs(value: unknown): WeatherArgs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new WeatherToolError('INVALID_WEATHER_ARGS', 400);
  const source = value as Record<string, unknown>;
  for (const field of Object.keys(source)) if (!ARG_FIELDS.has(field)) throw new WeatherToolError('INVALID_WEATHER_ARGS', 400);
  const location = typeof source.location === 'string' ? source.location.replace(/\s+/g, ' ').trim() : '';
  if (!location || location.length > MAX_LOCATION_LENGTH) throw new WeatherToolError('INVALID_WEATHER_LOCATION', 400);
  const rawDays = source.days ?? DEFAULT_DAYS;
  if (!Number.isInteger(rawDays) || Number(rawDays) < 1 || Number(rawDays) > MAX_DAYS) throw new WeatherToolError('INVALID_WEATHER_DAYS', 400);
  return Object.freeze({ location, days: Number(rawDays) });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function str(value: unknown, max = 120): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}
// Models misjudge weekdays from bare ISO dates, so the tool states them explicitly.
function weekday(date: unknown): string {
  const value = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : null;
  return value && Number.isFinite(value.getTime()) ? new Intl.DateTimeFormat('tr-TR', { weekday: 'long', timeZone: 'UTC' }).format(value) : '';
}
function condition(code: unknown): string {
  const value = num(code);
  return value === null ? 'Bilinmiyor' : CONDITIONS[value] ?? 'Bilinmiyor';
}

async function getJson(fetchImpl: FetchLike, url: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  let response;
  try {
    response = await fetchImpl(url, { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new WeatherToolError('WEATHER_UNAVAILABLE', 502);
  }
  if (!response.ok) throw new WeatherToolError('WEATHER_UNAVAILABLE', 502);
  try {
    return record(await response.json());
  } catch {
    throw new WeatherToolError('WEATHER_UNAVAILABLE', 502);
  }
}

// "Ankara, Türkiye" is not a valid geocoding query; search the place and use the rest to pick the right match.
function pickPlace(results: unknown, hint: string): Record<string, unknown> | null {
  const places = Array.isArray(results) ? results.map(record) : [];
  if (!places.length) return null;
  const needle = hint.toLocaleLowerCase('tr');
  if (needle) {
    const match = places.find((place) => [place.country, place.admin1, place.country_code]
      .some((field) => typeof field === 'string' && field.toLocaleLowerCase('tr').includes(needle)));
    if (match) return match;
  }
  return places[0];
}

export function createWeatherLookup({ fetchImpl = globalThis.fetch as unknown as FetchLike }: { readonly fetchImpl?: FetchLike } = {}) {
  return async function lookupWeather(args: unknown, signal?: AbortSignal) {
    const { location, days } = normalizeWeatherArgs(args);
    const [place, ...rest] = location.split(',').map((part) => part.trim());
    const geoUrl = `${GEOCODING_URL}?${new URLSearchParams({ name: place, count: '10', language: 'tr', format: 'json' })}`;
    const geo = await getJson(fetchImpl, geoUrl, signal);
    const match = pickPlace(geo.results, rest.join(' '));
    const latitude = num(match?.latitude);
    const longitude = num(match?.longitude);
    if (!match || latitude === null || longitude === null) throw new WeatherToolError('WEATHER_LOCATION_NOT_FOUND', 404);

    const forecastUrl = `${FORECAST_URL}?${new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: String(days)
    })}`;
    const forecast = await getJson(fetchImpl, forecastUrl, signal);
    const current = record(forecast.current);
    const daily = record(forecast.daily);
    const dates = Array.isArray(daily.time) ? daily.time.slice(0, days) : [];
    const at = (key: string, index: number) => (Array.isArray(daily[key]) ? (daily[key] as unknown[])[index] : undefined);

    return {
      source: 'Open-Meteo',
      location: {
        name: str(match.name),
        region: str(match.admin1),
        country: str(match.country),
        latitude,
        longitude,
        timezone: str(forecast.timezone || match.timezone, 64)
      },
      current: {
        time: str(current.time, 32),
        condition: condition(current.weather_code),
        temperatureC: num(current.temperature_2m),
        feelsLikeC: num(current.apparent_temperature),
        humidityPercent: num(current.relative_humidity_2m),
        precipitationMm: num(current.precipitation),
        windKmh: num(current.wind_speed_10m)
      },
      daily: dates.map((date, index) => ({
        date: str(date, 16),
        weekday: weekday(date),
        condition: condition(at('weather_code', index)),
        minC: num(at('temperature_2m_min', index)),
        maxC: num(at('temperature_2m_max', index)),
        precipitationProbabilityPercent: num(at('precipitation_probability_max', index))
      }))
    };
  };
}

export const WEATHER_TOOL_DEFINITION = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'weather_forecast',
    description: 'Bir şehir veya yer için güncel hava durumunu ve günlük tahmini getirir (canlı veri, Open-Meteo). Kullanıcı hava durumu, sıcaklık, yağmur, kar veya rüzgar sorduğunda kullan.',
    parameters: Object.freeze({
      type: 'object',
      properties: Object.freeze({
        location: Object.freeze({ type: 'string', maxLength: MAX_LOCATION_LENGTH, description: 'Şehir veya yer adı, örn. "Ankara" ya da "Paris, Fransa".' }),
        days: Object.freeze({ type: 'integer', minimum: 1, maximum: MAX_DAYS, description: 'Kaç günlük tahmin (varsayılan 3).' })
      }),
      required: Object.freeze(['location']),
      additionalProperties: false
    })
  })
});
