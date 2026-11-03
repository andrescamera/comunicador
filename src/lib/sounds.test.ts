import { describe, expect, it } from 'vitest'
import { recordingType, soundQuery } from './sounds'

describe('recordingType', () => {
  it('AAC del grabador (m4a/mp4) se guarda como audio/mp4', () => {
    expect(recordingType('audio/mp4')).toEqual({ contentType: 'audio/mp4', ext: 'm4a' })
    expect(recordingType('audio/mp4;codecs=mp4a.40.2')).toEqual({ contentType: 'audio/mp4', ext: 'm4a' })
    expect(recordingType('audio/x-m4a')).toEqual({ contentType: 'audio/mp4', ext: 'm4a' })
  })
  it('Opus de Chrome/Firefox se guarda como audio/webm', () => {
    expect(recordingType('audio/webm;codecs=opus')).toEqual({ contentType: 'audio/webm', ext: 'webm' })
    expect(recordingType('video/webm')).toEqual({ contentType: 'audio/webm', ext: 'webm' })
  })
})

describe('soundQuery', () => {
  it('traduce lo conocido, también en plural', () => {
    expect(soundQuery('Vacas')).toBe('cow moo')
    expect(soundQuery('xilófono')).toBe('xilófono')
  })
})
