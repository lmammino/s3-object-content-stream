const S3ObjectContentStream = require(process.env.BUILD
  ? '../pkg/dist-node/'
  : './')

class MockS3 {
  constructor (mockedPages, shouldFail = false) {
    this._mockedPages = mockedPages
    this._currentPage = 0
    this._shouldFail = shouldFail
    this._receivedParams = []
  }

  listObjectsV2 (params, cb) {
    this._receivedParams.push(params)
    process.nextTick(() => {
      const error = this._shouldFail ? new Error('some error') : null
      const response = this._shouldFail
        ? null
        : this._mockedPages[this._currentPage++]
      cb(error, response)
    })
  }
}

const createPage = (numItems, startCount = 0, last = false) => {
  const items = []
  for (let i = 0; i < numItems; i++) {
    items.push({
      ETag: `etag-${i + startCount}`,
      Key: `${i + startCount}.jpg`,
      LastModified: '2019-02-19T19:35:20.892Z',
      Size: (i + startCount) * 100,
      StorageClass: 'STANDARD'
    })
  }

  return {
    Contents: items,
    IsTruncated: !last,
    KeyCount: numItems,
    MaxKeys: numItems,
    Name: 'examplebucket',
    NextContinuationToken: last ? undefined : `token-${numItems + startCount}`,
    Prefix: ''
  }
}
