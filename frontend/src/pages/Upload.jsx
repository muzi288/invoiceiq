import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { uploadInvoice } from '../services/api'
import Layout from '../components/Layout'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [category, setCategory] = useState('uncategorised')
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const onDrop = useCallback((acceptedFiles) => {
    setFile(acceptedFiles[0])
    setError('')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', category)
      formData.append('tags', tags)

      const res = await uploadInvoice(formData)
      navigate(`/invoices/${res.data.invoice_id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-white mb-6">Upload Invoice</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 text-sm rounded">
              {error}
            </div>
          )}

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-amber-500 bg-amber-500/5'
                : file
                ? 'border-green-600 bg-green-900/10'
                : 'border-gray-700 hover:border-gray-500'
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div>
                <p className="text-green-400 text-sm font-medium">{file.name}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
            ) : isDragActive ? (
              <p className="text-amber-400 text-sm">Drop the file here</p>
            ) : (
              <div>
                <p className="text-gray-400 text-sm">
                  Drag and drop an invoice here
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  PDF, JPEG, or PNG — max 10MB
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. urgent, Q1, project-alpha (comma separated)"
              className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="uncategorised">Uncategorised</option>
              <option value="inventory">Inventory</option>
              <option value="utilities">Utilities</option>
              <option value="equipment">Equipment</option>
              <option value="payroll">Payroll</option>
              <option value="travel">Travel</option>
              <option value="office">Office</option>
              <option value="other">Other</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={!file || loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-medium py-2 px-4 rounded text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Uploading...' : 'Upload & Extract'}
          </button>
        </form>
      </div>
    </Layout>
  )
}
