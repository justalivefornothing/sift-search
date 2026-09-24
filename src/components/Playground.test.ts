// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Playground } from './Playground.tsx'

const mock = vi.hoisted(() => ({
  status: 'ready',
  playground: {
    open: true,
    body: '{"query":"matrix"}',
    error: null as string | null,
    response: null,
    timing: null,
  },
  run: vi.fn(async () => {}),
}))

vi.mock('../store.ts', () => ({
  useStore: (selector: (state: unknown) => unknown) => selector({
    status: mock.status,
    playground: mock.playground,
    setPlaygroundOpen: vi.fn(),
    setPlaygroundBody: vi.fn(),
    runPlayground: mock.run,
    syncPlaygroundBody: vi.fn(),
  }),
}))

describe('playground Run button recovery', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    mock.status = 'ready'
    mock.playground.body = '{"query":"matrix"}'
    mock.playground.error = null
    mock.run.mockClear()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  async function renderRunButton(): Promise<HTMLButtonElement> {
    await act(async () => root.render(createElement(Playground)))
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.trim() === 'Run')
    if (!button) throw new Error('Run button was not rendered')
    return button
  }

  it('allows click retry after a runtime error without editing a valid body', async () => {
    const body = mock.playground.body
    let run = await renderRunButton()
    expect(run.disabled).toBe(false)
    await act(async () => run.click())
    expect(mock.run).toHaveBeenCalledTimes(1)

    mock.playground.error = 'Temporary query execution failure'
    run = await renderRunButton()
    expect(mock.playground.body).toBe(body)
    expect(run.disabled).toBe(false)
    await act(async () => run.click())
    expect(mock.run).toHaveBeenCalledTimes(2)
  })

  it.each(['{"query":', '{"query":"matrix","facets":3}'])('blocks invalid input %s and re-enables after correction', async (body) => {
    mock.playground.body = body
    mock.playground.error = 'Invalid request'
    let run = await renderRunButton()
    expect(run.disabled).toBe(true)
    await act(async () => run.click())
    expect(mock.run).not.toHaveBeenCalled()

    mock.playground.body = '{"query":"matrix"}'
    mock.playground.error = null
    run = await renderRunButton()
    expect(run.disabled).toBe(false)
    await act(async () => run.click())
    expect(mock.run).toHaveBeenCalledOnce()
  })

  it('blocks valid input while the worker is unavailable', async () => {
    mock.status = 'loading'
    expect((await renderRunButton()).disabled).toBe(true)
  })
})
