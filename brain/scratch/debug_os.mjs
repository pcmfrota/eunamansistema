import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ffvwappomyuhyyeylpgt.supabase.co'
const supabaseKey = 'sb_publishable_Mq3FIfJZHUqt0BjvnQ6LoA_isrFPOt2'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  console.log("Checking OS records...")
  const { data, error } = await supabase
    .from('ordens_servico')
    .select('id, data_abertura, data_parada, placa, status')
    .order('data_abertura', { ascending: false })
    .limit(10)

  if (error) {
    console.error("Error:", error)
    return
  }

  console.log("Found", data.length, "recent OS:")
  data.forEach(os => {
    console.log(`ID: ${os.id} | Abertura: ${os.data_abertura} | Placa: ${os.placa} | Status: ${os.status}`)
  })

  const inicio = '2026-03-23'
  const fim = '2026-04-21'
  console.log(`\nTesting filter: >= ${inicio} and <= ${fim}`)
  
  const filtered = data.filter(os => {
    const d = os.data_abertura
    return d >= inicio && d <= fim
  })
  
  console.log("Results matching filter:", filtered.length)
}

test()
