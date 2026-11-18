import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowDownToLine, X } from 'lucide-react'
import { motion } from 'motion/react'
import type { SharedFile } from '../types'

const controlClass = 'grid size-11 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30 focus-visible:outline-white'

export function ImageLightbox({ item, imageUrl, onClose }: {
  item: SharedFile
  imageUrl: string
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const [failed, setFailed] = useState(false)

  useLayoutEffect(() => {
    const panel = dialog.current
    panel?.showModal()
    closeButton.current?.focus()
    return () => panel?.close()
  }, [])

  return (
    <motion.dialog ref={dialog} aria-label={item.fileName}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
      className="image-lightbox glass-lightbox fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none place-items-center overflow-hidden bg-black/85 p-4 text-white backdrop-blur-xl open:grid">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <a href={item.downloadUrl} download={item.fileName} aria-label="Скачать" className={controlClass}>
          <ArrowDownToLine className="size-[18px]" />
        </a>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Закрыть" className={controlClass}>
          <X className="size-5" />
        </button>
      </div>
      {failed ? (
        <p className="rounded-2xl bg-shared-ink p-5 text-center text-sm" role="alert">Не удалось открыть изображение.</p>
      ) : (
        <motion.img initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }} src={imageUrl} alt={item.caption || item.fileName}
          onError={() => setFailed(true)}
          className="max-h-[86dvh] max-w-[92vw] rounded-[20px] object-contain shadow-2xl" />
      )}
    </motion.dialog>
  )
}
