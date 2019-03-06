const crypto = require('crypto')
const { Readable, Transform } = require('readable-stream')
const S3ObjectContentStream = require(process.env.BUILD
  ? '../pkg/dist-node/'
  : './')

class Md5ify extends Transform {
  constructor (options) {
    super(options)
    this._buff = Buffer.from([])
  }

  _transform (chunk, encoding, callback) {
    this._buff = Buffer.concat([this._buff, chunk])
    callback()
  }

  _flush (callback) {
    const md5 = crypto.createHash('md5').update(this._buff).digest('hex')
    this.push(md5)
    callback()
  }
}

class ArrayReadable extends Readable {
  constructor (data, options) {
    super(options)
    this._data = data
    this._index = 0
  }

  _read () {
    if (this._index >= this._data.length) {
      return this.push(null)
    }

    return this.push(this._data[this._index++])
  }
}

class RawReadable extends Readable {
  constructor (content, options) {
    super(options)
    this._content = content
    this._pointer = 0
  }

  _read (size) {
    if (this._pointer >= this._content.length) {
      return this.push(null)
    }

    const nextPointer = this._pointer + size + 1
    const chunk = Buffer.from(this._content.substr(this._pointer, nextPointer))
    this._pointer = nextPointer
    return process.nextTick(() => this.push(chunk))
  }
}

class MockS3 {
  constructor (objectContentMap, shouldFail = false) {
    this._objectContentMap = objectContentMap
    this._shouldFail = shouldFail
    this._receivedParams = []
  }

  getObject (params) {
    this._receivedParams.push(params)
    if (this._shouldFail || typeof (this._objectContentMap[params.Key]) === 'undefined') {
      throw new Error('ObjectNotFound')
    }
    const content = this._objectContentMap[params.Key]
    return ({
      createReadStream () {
        return new RawReadable(content)
      }
    })
  }
}

test('It should return concatenated output from multiple buckets', (done) => {
  const objectContentMap = {
    'files/file1': 'some data',
    'files/file2': 'some more data',
    'files/file3': 'even moar data'
  }
  const sourceStream = new ArrayReadable(Object.keys(objectContentMap))
  const s3 = new MockS3(objectContentMap)

  const objectContentStream = new S3ObjectContentStream(s3, 'some-bucket')

  const expectedData = Object.values(objectContentMap).join('')

  let emittedData = ''

  sourceStream
    .pipe(objectContentStream)
    .on('data', (d) => {
      emittedData = emittedData + d
    })
    .on('error', (err) => {
      throw err
    })
    .on('finish', () => {
      expect(s3._receivedParams).toMatchSnapshot()
      expect(emittedData).toEqual(expectedData)
      done()
    })
})

test('It should operate if the source stream is in fullMetadata mode', (done) => {
  const bucketName = 'some-bucket'
  const objectContentMap = {
    'files/file1': 'some data',
    'files/file2': 'some more data',
    'files/file3': 'even moar data'
  }
  const objectsFullMeta = Object.keys(objectContentMap)
    .map((name) => ({
      Key: name,
      Bucket: bucketName,
      ETag: crypto.createHash('md5').update(objectContentMap[name]).digest('hex'),
      Size: objectContentMap[name].length
    }))
  const sourceStream = new ArrayReadable(objectsFullMeta, { objectMode: true })

  const s3 = new MockS3(objectContentMap)

  const objectContentStream = new S3ObjectContentStream(s3, bucketName, undefined, { fullMetadata: true })

  const expectedData = Object.values(objectContentMap).join('')

  let emittedData = ''

  sourceStream
    .pipe(objectContentStream)
    .on('data', (d) => {
      emittedData = emittedData + d
    })
    .on('error', (err) => {
      throw err
    })
    .on('finish', () => {
      expect(s3._receivedParams).toMatchSnapshot()
      expect(emittedData).toEqual(expectedData)
      done()
    })
})

test('It should fail if operating in full metadata mode but the received object is not conform to the expected format', (done) => {
  const bucketName = 'some-bucket'
  const objectContentMap = {
    'files/file1': 'some data',
    'files/file2': 'some more data',
    'files/file3': 'even moar data'
  }
  const objectsFullMeta = Object.keys(objectContentMap)
    .map((name) => ({
      SomeNonCompliantField: name
    }))
  const sourceStream = new ArrayReadable(objectsFullMeta, { objectMode: true })

  const s3 = new MockS3(objectContentMap)

  const objectContentStream = new S3ObjectContentStream(s3, bucketName, undefined, { fullMetadata: true })

  sourceStream
    .pipe(objectContentStream)
    .on('error', (err) => {
      expect(err.message).toEqual('Invalid chunk: the given chunk is not an object with a property "Key" (string)')
      done()
    })
})

test('It should be possible to use a transform stream to transform the content of every single object', (done) => {
  const objectContentMap = {
    'files/file1': 'some data',
    'files/file2': 'some more data',
    'files/file3': 'even moar data'
  }
  const sourceStream = new ArrayReadable(Object.keys(objectContentMap))
  const s3 = new MockS3(objectContentMap)

  const objectContentStream = new S3ObjectContentStream(s3, 'some-bucket', () => new Md5ify())

  const expectedData = Object.values(objectContentMap).map((d) => crypto.createHash('md5').update(d).digest('hex')).join('')

  let emittedData = ''

  sourceStream
    .pipe(objectContentStream)
    .on('data', (d) => {
      emittedData = emittedData + d
    })
    .on('error', (err) => {
      throw err
    })
    .on('finish', () => {
      expect(s3._receivedParams).toMatchSnapshot()
      expect(emittedData).toEqual(expectedData)
      done()
    })
})

test('It should report an error correctly if something goes wrong', (done) => {
  const objectContentMap = {
    'files/file1': 'some data',
    'files/file2': 'some more data',
    'files/file3': 'even moar data'
  }
  const sourceStream = new ArrayReadable(Object.keys(objectContentMap))
  const s3 = new MockS3(objectContentMap, true)

  const objectContentStream = new S3ObjectContentStream(s3, 'some-bucket')

  sourceStream
    .pipe(objectContentStream)
    .on('error', (err) => {
      expect(err.message).toEqual('ObjectNotFound')
      done()
    })
})
