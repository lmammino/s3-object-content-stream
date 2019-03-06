'use strict'

const { Transform, finished } = require('readable-stream')

/**
 * Stream options
 * @typedef {Object} S3ObjectContentStreamOptions
 * @property {boolean} fullMetadata - If true the stream will assume the incoming metadata is in fullmetadata format (objects that contain a property calle "Key"). Default `false`
 */
const defaultOptions = {
  fullMetadata: false
}

/**
 * Transform stream that receives S3 object keys and emits their content
 * @extends Transform
 */
class S3ObjectContentStream extends Transform {
  /**
   * Initialize a new instance of S3ObjectContentStream (invoked with new S3ObjectContentStream)
   * @param {Object} s3               An S3 client from the AWS SDK (or any object that implements a compatible `listObjectsV2` method)
   * @param {string} bucket           The name of the bucket to list
   * @param {function} contentTransform An optional factory function that returns a transform stream that will be
   *  used to transform the content of an object before it gets emitted (useful for instance if you want to decrypt or decompress the object). The factory function receives the current chunk as argument
   * @param {S3ObjectContentStreamOptions} options          Transform stream options
   */
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
      if (
        this._fullMetadata &&
        (!chunk || !chunk.Key || typeof chunk.Key !== 'string')
      ) {
        throw new Error(
          'Invalid chunk: the given chunk is not an object with a property "Key" (string)'
        )
      }

      const params = {
        Bucket: this._bucket,
        Key: this._fullMetadata ? chunk.Key : chunk.toString()
      }

      let objectStream = this._s3.getObject(params).createReadStream()

      if (typeof this._contentTransform === 'function') {
        objectStream = objectStream.pipe(this._contentTransform(chunk))
      }

      objectStream
        .on('data', data => this.push(data))
        .on('error', err => this.emit('error', err))

      finished(objectStream, callback)
    } catch (err) {
      return callback(err)
    }
  }
}

module.exports = S3ObjectContentStream
