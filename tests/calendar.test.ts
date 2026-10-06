import { describe, it, expect } from 'vitest';
import { clock, moveSchedule, resizeSchedule, snappedMinute } from '../src/shared/calendar.js';

describe('calendar time changes', () => {
  it('moves without changing duration and keeps both times on the same day', () => {
    expect(moveSchedule('10:00', '11:00', 690, 15)).toEqual({ start: 690, end: 750 });
    expect(moveSchedule('09:07', '09:24', 780, 30)).toEqual({ start: 780, end: 797 });
    const late = moveSchedule('10:00', '11:00', 1440, 15);
    expect(late.end).toBeLessThan(1440); expect(late.end - late.start).toBe(60);
    expect(moveSchedule('10:00', '11:00', -40, 15)).toEqual({ start: 0, end: 60 });
  });
  it('changes only the dragged edge, prevents reversal and bounds midnight', () => {
    expect(resizeSchedule('10:00', '11:00', 'end', 690, 15)).toEqual({ start: 600, end: 690 });
    expect(resizeSchedule('10:00', '11:00', 'start', 570, 15)).toEqual({ start: 570, end: 660 });
    expect(resizeSchedule('10:00', '11:00', 'end', 500, 30)).toEqual({ start: 600, end: 630 });
    expect(resizeSchedule('10:00', '11:00', 'start', 800, 30)).toEqual({ start: 630, end: 660 });
    expect(resizeSchedule('23:45', '23:59', 'end', 1500, 30)).toEqual({ start: 1425, end: 1439 });
    expect(resizeSchedule('00:00', '00:10', 'start', -100, 30)).toEqual({ start: 0, end: 10 });
  });
  it('floors additions without advancing past the pointer and never formats 24:00', () => {
    expect(snappedMinute(792, 15)).toBe(780); expect(snappedMinute(792, 30)).toBe(780);
    expect(snappedMinute(719, 30)).toBe(690); expect(snappedMinute(719, 15)).toBe(705);
    expect(snappedMinute(720, 30)).toBe(720); expect(snappedMinute(-1, 30)).toBe(0);
    expect(clock(snappedMinute(1440, 15))).toBe('23:45'); expect(clock(1439)).toBe('23:59');
  });
});
