// Live weather, with bounded retries, independent fallback and labelled cached data.
// All upstream hosts are fixed; the model cannot supply a URL.
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const FALLBACK_URL = 'https://wttr.in/';
const REQUEST_TIMEOUT_MS = 4500;
const FRESH_MS = 5 * 60_000;
const STALE_MS = 60 * 60_000;
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
    const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    response = await fetchImpl(url, { signal: signal ? AbortSignal.any([signal, deadline]) : deadline, headers: { Accept: 'application/json' } });
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

// City-centre coordinates only: these do not represent a user's physical location.
const TURKISH_CITIES: Readonly<Record<string, readonly [string,number,number]>> = Object.freeze({
  ankara:['Ankara',39.9334,32.8597], istanbul:['İstanbul',41.0082,28.9784],
  izmir:['İzmir',38.4237,27.1428], bursa:['Bursa',40.195,29.06],
  antalya:['Antalya',36.8969,30.7133], adana:['Adana',37.0,35.3213],
  konya:['Konya',37.8714,32.4846], eskisehir:['Eskişehir',39.7767,30.5206],
  gaziantep:['Gaziantep',37.0662,37.3833], trabzon:['Trabzon',41.0027,39.7168]
});
function cityKey(value: string): string {
  return value.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').trim();
}
function localCity(place: string, hint: string): Record<string, unknown> | null {
  const key=cityKey(place);
  if (!Object.hasOwn(TURKISH_CITIES,key)) return null;
  if (hint && !['turkiye','turkey','tr',key].includes(cityKey(hint))) return null;
  const [name,latitude,longitude]=TURKISH_CITIES[key];
  return {name,admin1:name,country:'Türkiye',country_code:'TR',latitude,longitude,timezone:'Europe/Istanbul'};
}
function numeric(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() && /^-?\d+(?:\.\d+)?$/.test(value)) return num(Number(value));
  return num(value);
}
function first(value: unknown): Record<string, unknown> {
  return Array.isArray(value) ? record(value[0]) : {};
}
function wttrCondition(code: unknown): string {
  const n=numeric(code);
  if(n===113)return 'Açık';
  if(n===116)return 'Parçalı bulutlu';
  if(n===119||n===122)return 'Kapalı';
  if(n===143||n===248||n===260)return 'Sisli';
  if(n!==null&&[200,386,389,392,395].includes(n))return 'Gök gürültülü fırtına';
  if(n!==null&&[179,182,185,227,230,281,284,311,314,317,320,323,326,329,332,335,338,350,362,365,368,371,374,377].includes(n))return 'Kar veya donan yağış';
  if(n!==null&&[176,263,266,293,296,299,302,305,308,353,356,359].includes(n))return 'Yağmurlu';
  return 'Bilinmiyor';
}
function normalizeFallback(data: Record<string,unknown>,match: Record<string,unknown>,days: number) {
  const current=first(data.current_condition);
  const rows=Array.isArray(data.weather)?data.weather.slice(0,days).map(record):[];
  const daily=rows.filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(str(row.date))).map(row=>{
    const hours=Array.isArray(row.hourly)?row.hourly.map(record):[];
    const representative=hours.find(h=>String(h.time)==='1200')||hours[0]||{};
    const chances=hours.map(h=>numeric(h.chanceofrain)).filter((v):v is number=>v!==null);
    return {date:str(row.date,16),weekday:weekday(row.date),condition:wttrCondition(representative.weatherCode),
      minC:numeric(row.mintempC),maxC:numeric(row.maxtempC),
      precipitationProbabilityPercent:chances.length?Math.max(...chances):null};
  });
  if(numeric(current.temp_C)===null||!daily.some(d=>d.maxC!==null))throw new WeatherToolError('WEATHER_UNAVAILABLE',502);
  return {source:'wttr.in',location:{name:str(match.name),region:str(match.admin1),country:str(match.country),
    latitude:num(match.latitude),longitude:num(match.longitude),timezone:str(match.timezone,64)},
    current:{time:str(current.localObsDateTime||current.observation_time,32),condition:wttrCondition(current.weatherCode),
      temperatureC:numeric(current.temp_C),feelsLikeC:numeric(current.FeelsLikeC),humidityPercent:numeric(current.humidity),
      precipitationMm:numeric(current.precipMM),windKmh:numeric(current.windspeedKmph)},daily};
}

export function createWeatherLookup({ fetchImpl = globalThis.fetch as unknown as FetchLike, now=Date.now }: { readonly fetchImpl?: FetchLike; readonly now?:()=>number } = {}) {
  type Result = ReturnType<typeof normalizeFallback>;
  const cache=new Map<string,{value:Result;at:number}>();
  return async function lookupWeather(args: unknown, signal?: AbortSignal) {
    const { location, days } = normalizeWeatherArgs(args);
    const key=cityKey(location)+':'+days;
    const cached=cache.get(key);
    signal?.throwIfAborted();
    if(cached&&now()-cached.at<FRESH_MS)return {...cached.value, fetchedAt:new Date(cached.at).toISOString(),freshness:'recent_cache',requestedDays:days};
    const save=(value:Result)=>{
      const at=now();cache.delete(key);cache.set(key,{value,at});
      if(cache.size>128)cache.delete(cache.keys().next().value!);
      return {...value,fetchedAt:new Date(at).toISOString(),freshness:'live',requestedDays:days,
        ...(value.daily.length<days?{warning:'Kaynak istenen gün sayısından daha az tahmin sağladı. Eksik günleri uydurma.'}:{})};
    };
    try {
      const [place, ...rest] = location.split(',').map(part=>part.trim());
      const hint=rest.join(' ');
      let match:Record<string,unknown>|null=null;
      try {
        const geoUrl=GEOCODING_URL+'?'+new URLSearchParams({name:place,count:'10',language:'tr',format:'json'});
        const geo=await getJson(fetchImpl,geoUrl,signal);
        match=pickPlace(geo.results,hint);
      } catch(error) {
        signal?.throwIfAborted();
        match=localCity(place,hint);
        if(!match)throw error;
      }
      match=match||localCity(place,hint);
      const latitude=num(match?.latitude),longitude=num(match?.longitude);
      if(!match||latitude===null||longitude===null||Math.abs(latitude)>90||Math.abs(longitude)>180)throw new WeatherToolError('WEATHER_LOCATION_NOT_FOUND',404);
      const forecastUrl=FORECAST_URL+'?'+new URLSearchParams({
        latitude:String(latitude),longitude:String(longitude),
        current:'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
        daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        timezone:'auto',forecast_days:String(days)
      });
      const parsePrimary=(forecast:Record<string,unknown>):Result=>{
    const current = record(forecast.current);
    const daily = record(forecast.daily);
    const dates = Array.isArray(daily.time) ? daily.time.slice(0, days) : [];
    const at = (key: string, index: number) => (Array.isArray(daily[key]) ? (daily[key] as unknown[])[index] : undefined);

    if (!dates.length || num(current.temperature_2m) === null || !dates.some((_, index) => num(at('temperature_2m_max', index)) !== null)) throw new WeatherToolError('WEATHER_UNAVAILABLE', 502);
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
      try {
        return save(parsePrimary(await getJson(fetchImpl,forecastUrl,signal)));
      } catch {
        signal?.throwIfAborted();
        // Alternate service uses resolved coordinates, never an unchecked URL or city guess.
        try {
          const fallback=await getJson(fetchImpl,FALLBACK_URL+encodeURIComponent(latitude+','+longitude)+'?format=j1',signal);
          return save(normalizeFallback(fallback,match,days));
        } catch {
          signal?.throwIfAborted();
          // Retry the primary once, after attempting the independent service.
          return save(parsePrimary(await getJson(fetchImpl,forecastUrl,signal)));
        }
      }
    } catch(error) {
      signal?.throwIfAborted();
      if(error instanceof WeatherToolError&&error.status===404)throw error;
      if(cached&&now()-cached.at<STALE_MS)return {...cached.value,fetchedAt:new Date(cached.at).toISOString(),freshness:'stale',requestedDays:days,warning:'Canlı kaynaklara erişilemedi; bu daha önce alınmış veridir. Güncel olarak sunma.'};
      throw error;
    }
  };
}

export const WEATHER_TOOL_DEFINITION = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'weather_forecast',
    description: 'Bir şehir veya yer için güncel hava durumunu ve günlük tahmini getirir (Open-Meteo, gerektiğinde wttr.in veya açıkça etiketlenen önbellek). Hava durumu, sıcaklık, yağmur, kar veya rüzgar sorularında kullan; kaynak, veri zamanı ve varsa eksik gün/önbellek uyarısını belirt. Veri yoksa uydurma; mümkünse web aramasıyla güncel güvenilir kaynakları kontrol et.',
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
