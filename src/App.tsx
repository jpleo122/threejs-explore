import { SimHost } from '@/components/SimHost'
import { SimSidebar } from '@/components/SimSidebar'
import { useHashRoute } from '@/hooks/useHashRoute'

export function App() {
  const [id, navigate] = useHashRoute()

  return (
    <>
      <SimHost key={id} id={id} />
      <SimSidebar current={id} onSelect={navigate} />
    </>
  )
}
