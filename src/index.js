'use strict'

const { Transform, finished } = require('readable-stream')

const defaultOptions = {
  fullMetadata: false
}

class S3ObjectContentStream extends Transform {
  constructor (s3, bucket, contentTransform, options) {
    const mergedOptions = Object.assign({}, defaultOptions, options)

    // forces object mode if full metadata is enabled
    if (mergedOptions.fullMetadata) {
      mergedOptions.objectMode = true
    }

    super(mergedOptions)
    this._s3 = s3
    this._bucket = bucket
    this._contentTransform = contentTransform
    this._fullMetadata = mergedOptions.fullMetadata
  }

  _transform (chunk, encoding, callback) {
    try {
      if (this._fullMetadata && (!chunk || !chunk.Key || typeof chunk.Key !== 'string')) {
        throw new Error('Invalid chunk: the given chunk is not an object with a property "Key" (string)')
      }

      const params = {
        Bucket: this._bucket,
        Key: this._fullMetadata ? chunk.Key : chunk.toString()
      }

      let objectStream = this._s3.getObject(params).createReadStream()

      if (typeof this._contentTransform === 'function') {
        objectStream = objectStream.pipe(this._contentTransform())
      }

      objectStream
        .on('data', (data) => this.push(data))
        .on('error', (err) => this.emit('error', err))

      finished(objectStream, callback)
    } catch (err) {
      return callback(err)
    }
  }
}

module.exports = S3ObjectContentStream
