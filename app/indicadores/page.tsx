import { getIndicadoresData } from './actions'
import IndicadoresClient from './IndicadoresClient'

export const dynamic = 'force-dynamic'

export default async function IndicadoresPage() {
  const now = new Date(Date.now() - 3 * 3600 * 1000)
  const initialData = await getIndicadoresData({
    mes: now.getMonth() + 1,
    ano: now.getFullYear(),
  })

  return <IndicadoresClient initialData={initialData} />
}
