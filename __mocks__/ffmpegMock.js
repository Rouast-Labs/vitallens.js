

export const FFmpeg = vi.fn().mockImplementation(() => ({
  load: vi.fn(),
  exec: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));