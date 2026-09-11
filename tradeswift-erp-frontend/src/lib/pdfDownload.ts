import { createElement, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

async function mountComponent<P extends object>(
  Component: ComponentType<P>,
  props: P,
): Promise<{ host: HTMLElement; root: Root }> {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = '210mm'
  host.style.zIndex = '-1'
  host.style.pointerEvents = 'none'
  document.body.appendChild(host)

  const root = createRoot(host)
  root.render(createElement(Component, props))
  await waitForPaint()
  return { host, root }
}

/** Capture a rendered React document root (by CSS selector) into an A4 PDF blob. */
export async function componentToPdfBlob<P extends object>(
  Component: ComponentType<P>,
  props: P,
  rootSelector: string,
): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const { host, root } = await mountComponent(Component, props)
  try {
    const target = host.querySelector(rootSelector) as HTMLElement | null
    if (!target) throw new Error('Document layout failed to render')

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    const img = canvas.toDataURL('image/jpeg', 0.95)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let heightLeft = imgHeight
    let position = 0
    pdf.addImage(img, 'JPEG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
    while (heightLeft > 0) {
      position -= pageHeight
      pdf.addPage()
      pdf.addImage(img, 'JPEG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }
    return pdf.output('blob')
  } finally {
    root.unmount()
    host.remove()
  }
}
