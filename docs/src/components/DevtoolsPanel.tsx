import { useEffect } from 'react'
import { mount } from '@umpire/devtools/slim'

type Props = {
  defaultTab?: 'matrix' | 'fouls' | 'graph' | 'reads'
}

export default function DevtoolsPanel({ defaultTab = 'matrix' }: Props) {
  useEffect(() => mount({ defaultTab }), [defaultTab])

  return null
}
