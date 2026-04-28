import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const leadId = formData.get('leadId') as string
    const type = formData.get('type') as string

    if (!file || !leadId) {
      return Response.json(
        { error: 'Missing file or leadId' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const fileExt = file.name.split('.').pop()
    const fileName = `${leadId}/${type}-${Date.now()}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('boq-documents')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true
      })

    if (error) {
      console.error('Supabase storage error:', error)
      return Response.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Since bucket is public, get public URL
    const { data: urlData } = supabase.storage
      .from('boq-documents')
      .getPublicUrl(fileName)

    return Response.json({
      url: urlData.publicUrl,
      path: fileName
    })

  } catch (err) {
    console.error('Upload route error:', err)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
