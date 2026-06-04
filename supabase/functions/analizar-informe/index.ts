import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function wrapText(text: string, width: number, font: any, fontSize: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > width) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No se proporcionó token de autorización')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    // Obtener parámetros
    const { informeId } = await req.json()
    if (!informeId) {
      throw new Error('Falta el parámetro informeId')
    }
    
    // 1. Obtener información del informe y consultorio
    const { data: informe, error: informeErr } = await supabaseClient
      .from('informes')
      .select('*, consultorios(*)')
      .eq('id', informeId)
      .single()
      
    if (informeErr || !informe) {
      throw new Error(`No se encontró el informe: ${informeErr?.message || 'Error desconocido'}`)
    }
    
    const consultorio = informe.consultorios
    if (!consultorio) {
      throw new Error('No se encontró el consultorio asociado al informe')
    }
    
    // 2. Descargar el reporte original de Storage
    const { data: fileData, error: downloadErr } = await supabaseClient
      .storage
      .from('informes')
      .download(informe.archivo_storage_path)
      
    if (downloadErr || !fileData) {
      throw new Error(`Error al descargar el archivo del storage: ${downloadErr?.message || 'Archivo vacío'}`)
    }
    
    // 3. Preparar archivo en base64 para enviarlo a Gemini
    const fileArrayBuffer = await fileData.arrayBuffer()
    const uint8Array = new Uint8Array(fileArrayBuffer)
    let binary = ''
    const len = uint8Array.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    const base64File = btoa(binary)
    
    // Configurar API de Gemini
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) {
      throw new Error('La variable de entorno GEMINI_API_KEY no está configurada')
    }
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
    
    // MimeType del archivo original
    const fileExt = informe.archivo_original.split('.').pop()?.toLowerCase() ?? ''
    let mimeType = 'application/pdf'
    if (fileExt === 'txt') mimeType = 'text/plain'
    else if (fileExt === 'png') mimeType = 'image/png'
    else if (fileExt === 'jpg' || fileExt === 'jpeg') mimeType = 'image/jpeg'
    
    const prompt = `Analiza este informe de biorresonancia. Genera un resumen ejecutivo claro y una interpretación de los resultados en un tono muy amigable, explicativo y empático para el paciente. 
Organiza la respuesta en las siguientes secciones usando Markdown limpio (sin asteriscos excesivos, usa encabezados simples):
1. Resumen General
2. Puntos Clave Identificados
3. Recomendaciones del Especialista
Evita explicaciones técnicas complejas. Mantén la explicación comprensible.`

    const geminiPayload = {
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64File
            }
          },
          {
            text: prompt
          }
        ]
      }]
    }
    
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    })
    
    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      throw new Error(`Error en API de Gemini: ${errText}`)
    }
    
    const geminiData = await geminiRes.json()
    const rawAnalysis = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar el análisis de la IA.'
    
    // 4. Guardar el análisis en la BD
    const { error: updateErr } = await supabaseClient
      .from('informes')
      .update({ resumen_ia: rawAnalysis })
      .eq('id', informeId)
      
    if (updateErr) {
      throw new Error(`Error al guardar el análisis en la base de datos: ${updateErr.message}`)
    }
    
    // 5. Generar PDF personalizado
    const pdfDoc = await PDFDocument.create()
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    
    let page = pdfDoc.addPage([612, 792]) // Carta (8.5 x 11 in)
    const { width, height } = page.getSize()
    
    // Intentar descargar e insertar el logo del consultorio
    let logoImage = null
    if (consultorio.logo_url) {
      try {
        const logoRes = await fetch(consultorio.logo_url)
        if (logoRes.ok) {
          const logoBytes = await logoRes.arrayBuffer()
          const lowerUrl = consultorio.logo_url.toLowerCase()
          if (lowerUrl.endsWith('.png') || logoRes.headers.get('content-type')?.includes('image/png')) {
            logoImage = await pdfDoc.embedPng(logoBytes)
          } else {
            logoImage = await pdfDoc.embedJpg(logoBytes)
          }
        }
      } catch (logoErr) {
        console.error('No se pudo incorporar el logo al PDF:', logoErr)
      }
    }
    
    // Dibujar encabezado
    // Barra superior decorativa verde (#10b981)
    page.drawRectangle({
      x: 0,
      y: height - 15,
      width: width,
      height: 15,
      color: rgb(0.06, 0.72, 0.51)
    })
    
    // Logo
    if (logoImage) {
      page.drawImage(logoImage, {
        x: 50,
        y: height - 85,
        width: 50,
        height: 50
      })
    }
    
    // Nombre y eslogan del consultorio
    page.drawText(consultorio.nombre || 'QuantumReport', {
      x: logoImage ? 115 : 50,
      y: height - 55,
      size: 18,
      font: fontBold,
      color: rgb(0.06, 0.72, 0.51)
    })
    
    if (consultorio.slogan) {
      page.drawText(consultorio.slogan, {
        x: logoImage ? 115 : 50,
        y: height - 72,
        size: 10,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4)
      })
    }
    
    // Caja de datos del paciente
    const margin = 50
    const contentWidth = width - 2 * margin
    page.drawRectangle({
      x: margin,
      y: height - 135,
      width: contentWidth,
      height: 40,
      color: rgb(0.96, 0.97, 0.96)
    })
    
    const formattedDate = new Date(informe.created_at).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    
    page.drawText(`Paciente: ${informe.paciente_nombre || 'N/A'}`, {
      x: margin + 15,
      y: height - 118,
      size: 9,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2)
    })
    page.drawText(`WhatsApp: ${informe.paciente_telefono || 'N/A'}`, {
      x: margin + 200,
      y: height - 118,
      size: 9,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2)
    })
    page.drawText(`Fecha: ${formattedDate}`, {
      x: margin + 370,
      y: height - 118,
      size: 9,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2)
    })
    
    // Dibujar contenido del análisis
    let y = height - 165
    const limitY = 50
    
    const drawLineText = (text: string, isTitle = false, isSubtitle = false) => {
      const fontSize = isTitle ? 14 : isSubtitle ? 11 : 9.5
      const font = (isTitle || isSubtitle) ? fontBold : fontRegular
      const lineHeight = fontSize + 5
      
      const wrappedLines = wrapText(text, contentWidth, font, fontSize)
      for (const wrappedLine of wrappedLines) {
        if (y - lineHeight < limitY) {
          page = pdfDoc.addPage([612, 792])
          y = height - margin
          
          // Barra decorativa en paginas siguientes
          page.drawRectangle({
            x: 0,
            y: height - 10,
            width: width,
            height: 10,
            color: rgb(0.06, 0.72, 0.51)
          })
          y -= 25
        }
        y -= lineHeight
        page.drawText(wrappedLine, {
          x: margin,
          y: y,
          size: fontSize,
          font: font,
          color: isTitle ? rgb(0.06, 0.72, 0.51) : rgb(0.15, 0.15, 0.15)
        })
      }
    }
    
    const analysisLines = rawAnalysis.split('\n')
    for (const line of analysisLines) {
      const trimmed = line.trim()
      if (!trimmed) {
        y -= 10
        continue
      }
      
      // Parsear títulos sencillos
      if (trimmed.startsWith('#')) {
        const titleText = trimmed.replace(/^#+\s*/, '')
        y -= 10
        drawLineText(titleText, true, false)
        y -= 5
      } else if (trimmed.match(/^(Resumen General|Puntos Clave|Recomendaciones|1\.|2\.|3\.|4\.)/i)) {
        y -= 5
        drawLineText(trimmed, false, true)
        y -= 3
      } else {
        drawLineText(trimmed, false, false)
      }
    }
    
    // Pie de página de validez
    const disclaimer = 'Este informe es un resumen interpretativo asistido por Inteligencia Artificial de QuantumReport. No reemplaza a un diagnóstico médico profesional.'
    y -= 25
    if (y < limitY + 20) {
      page = pdfDoc.addPage([612, 792])
      y = height - margin - 20
    }
    page.drawRectangle({
      x: margin,
      y: y - 10,
      width: contentWidth,
      height: 1,
      color: rgb(0.8, 0.8, 0.8)
    })
    y -= 25
    const wrappedDisclaimer = wrapText(disclaimer, contentWidth, fontRegular, 7.5)
    for (const lineText of wrappedDisclaimer) {
      page.drawText(lineText, {
        x: margin,
        y: y,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5)
      })
      y -= 10
    }
    
    // Guardar el PDF y subirlo al Storage
    const pdfBytes = await pdfDoc.save()
    const pdfPath = `${consultorio.id}/pdf-${informeId}.pdf`
    
    const { error: uploadPdfErr } = await supabaseClient
      .storage
      .from('informes')
      .upload(pdfPath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      })
      
    if (uploadPdfErr) {
      throw new Error(`Error al subir el PDF generado: ${uploadPdfErr.message}`)
    }
    
    // Generar la URL pública del PDF
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/informes/${pdfPath}`
    
    // Guardar la URL del PDF en la base de datos
    const { error: updatePdfErr } = await supabaseClient
      .from('informes')
      .update({ pdf_generado_path: publicUrl })
      .eq('id', informeId)
      
    if (updatePdfErr) {
      throw new Error(`Error al guardar la URL del PDF en la base de datos: ${updatePdfErr.message}`)
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      analysis: rawAnalysis, 
      pdfUrl: publicUrl 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
