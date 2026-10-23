import { describe, expect, it } from 'vitest';
import { loadAgentRegistry, resolveAgent } from './agent-runtime.ts';
import { executeNvidiaToolCall, getAllowedNvidiaTools } from './tool-runtime.ts';
import { createWeatherLookup, normalizeWeatherArgs, WeatherToolError } from './weather-tool.ts';

const ankara = { name: 'Ankara', admin1: 'Ankara', country: 'Türkiye', country_code: 'TR', latitude: 39.92, longitude: 32.85, timezone: 'Europe/Istanbul' };
const forecast = {
  timezone: 'Europe/Istanbul',
  current: { time: '2026-10-22T18:15', temperature_2m: 17, apparent_temperature: 16, relative_humidity_2m: 52, precipitation: 0, weather_code: 0, wind_speed_10m: 1.8 },
  daily: { time: ['2026-10-22', '2026-10-23'], weather_code: [1, 61], temperature_2m_max: [19.8, 21.5], temperature_2m_min: [4.1, 6.3], precipitation_probability_max: [0, 40] }
};

function fakeFetch(routes: { geo?: unknown; forecast?: unknown; status?: number }) {
  const calls: string[] = [];
  const fetchImpl = async (url: string) => {
    calls.push(url);
    const body = url.startsWith('https://geocoding-api.open-meteo.com/') ? routes.geo : routes.forecast;
    return { ok: (routes.status ?? 200) < 400, status: routes.status ?? 200, json: async () => body };
  };
  return { fetchImpl, calls };
}

describe('weather tool', () => {
  it('validates arguments strictly', () => {
    expect(normalizeWeatherArgs({ location: '  Ankara  ' })).toEqual({ location: 'Ankara', days: 3 });
    expect(normalizeWeatherArgs({ location: 'İzmir', days: 7 })).toEqual({ location: 'İzmir', days: 7 });
    for (const bad of [null, [], {}, { location: '' }, { location: 'x'.repeat(101) }, { location: 'Ankara', days: 0 }, { location: 'Ankara', days: 8 }, { location: 'Ankara', days: 1.5 }, { location: 'Ankara', url: 'http://evil' }]) {
      expect(() => normalizeWeatherArgs(bad)).toThrow(WeatherToolError);
    }
  });

  it('returns current conditions and daily forecast in Turkish', async () => {
    const { fetchImpl, calls } = fakeFetch({ geo: { results: [ankara] }, forecast });
    const result = await createWeatherLookup({ fetchImpl })({ location: 'Ankara', days: 2 });
    expect(result.location).toMatchObject({ name: 'Ankara', country: 'Türkiye', timezone: 'Europe/Istanbul' });
    expect(result.current).toMatchObject({ condition: 'Açık', temperatureC: 17, feelsLikeC: 16, windKmh: 1.8 });
    expect(result.daily).toEqual([
      { date: '2026-10-22', weekday: 'Perşembe', condition: 'Çoğunlukla açık', minC: 4.1, maxC: 19.8, precipitationProbabilityPercent: 0 },
      { date: '2026-10-23', weekday: 'Cuma', condition: 'Hafif yağmurlu', minC: 6.3, maxC: 21.5, precipitationProbabilityPercent: 40 }
    ]);
    expect(calls).toHaveLength(2);
    expect(calls.every((url) => url.startsWith('https://geocoding-api.open-meteo.com/') || url.startsWith('https://api.open-meteo.com/'))).toBe(true);
    expect(calls[1]).toContain('forecast_days=2');
  });

  it('uses the part after a comma to choose between same-named places', async () => {
    const paris = { ...ankara, name: 'Paris', admin1: 'Texas', country: 'Amerika Birleşik Devletleri', country_code: 'US', latitude: 33.66, longitude: -95.55 };
    const parisFr = { ...ankara, name: 'Paris', admin1: 'Île-de-France', country: 'Fransa', country_code: 'FR', latitude: 48.85, longitude: 2.35 };
    const { fetchImpl, calls } = fakeFetch({ geo: { results: [paris, parisFr] }, forecast });
    const result = await createWeatherLookup({ fetchImpl })({ location: 'Paris, Fransa' });
    expect(result.location.country).toBe('Fransa');
    expect(calls[0]).toContain('name=Paris&');
    expect(calls[1]).toContain('latitude=48.85');
  });

  it('reports unknown places and upstream failures with safe codes', async () => {
    await expect(createWeatherLookup(fakeFetch({ geo: { results: [] } }))({ location: 'Yokboyleyer' }))
      .rejects.toMatchObject({ code: 'WEATHER_LOCATION_NOT_FOUND', status: 404 });
    await expect(createWeatherLookup(fakeFetch({ status: 500 }))({ location: 'Ankara' }))
      .rejects.toMatchObject({ code: 'WEATHER_UNAVAILABLE', status: 502 });
    const throwing = async () => { throw new Error('getaddrinfo ENOTFOUND internal-detail'); };
    await expect(createWeatherLookup({ fetchImpl: throwing })({ location: 'Ankara' }))
      .rejects.toMatchObject({ code: 'WEATHER_UNAVAILABLE' });
  });

  it('is offered only when wired and only to agents allowed to read weather', async () => {
    const registry = await loadAgentRegistry();
    const hafize = resolveAgent(registry, 'hafize-general')!;
    const reviewer = resolveAgent(registry, 'agency-code-reviewer')!;
    const weatherLookup = createWeatherLookup(fakeFetch({ geo: { results: [ankara] }, forecast }));
    const names = (agent: typeof hafize, context: object) => getAllowedNvidiaTools(agent, context).map((tool) => tool.function.name);

    expect(names(hafize, {})).not.toContain('weather_forecast');
    expect(names(hafize, { weatherLookup })).toContain('weather_forecast');
    expect(names(reviewer, { weatherLookup })).not.toContain('weather_forecast');

    const call = { id: 'call_weather', type: 'function', function: { name: 'weather_forecast', arguments: '{"location":"Ankara"}' } };
    const traceId = '00000000-0000-4000-8000-000000000001';
    const ok = await executeNvidiaToolCall(hafize, call, { traceId, agent: hafize, weatherLookup });
    expect(ok).toMatchObject({ ok: true, tool: 'weather_forecast', value: { location: { name: 'Ankara' } } });
    const denied = await executeNvidiaToolCall(reviewer, call, { traceId, agent: reviewer, weatherLookup });
    expect(denied).toMatchObject({ ok: false, error: 'TOOL_NOT_AUTHORIZED' });
    const badArgs = await executeNvidiaToolCall(hafize, { ...call, function: { ...call.function, arguments: '{"location":"Ankara","url":"http://x"}' } }, { traceId, agent: hafize, weatherLookup });
    expect(badArgs).toMatchObject({ ok: false, error: 'INVALID_WEATHER_ARGS', status: 400 });
  });
});
