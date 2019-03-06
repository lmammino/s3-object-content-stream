# s3-object-content-stream

A Node.js transform stream that gets S3 object keys and emits their actual content

[![npm version](https://badge.fury.io/js/s3-object-content-stream.svg)](https://badge.fury.io/js/s3-object-content-stream)
[![CircleCI](https://circleci.com/gh/lmammino/s3-object-content-stream.svg?style=shield)](https://circleci.com/gh/lmammino/s3-object-content-stream)
[![Codecov coverage](https://codecov.io/gh/lmammino/s3-object-content-stream/branch/master/graph/badge.svg)](https://codecov.io/gh/lmammino/s3-object-content-stream)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Install

Using npm:

```bash
npm i --save s3-object-content-stream
```

or yarn

```bash
yarn add s3-object-content-stream
```

**Note:** In order to use this package you need to have the [`aws-sdk`](https://www.npmjs.com/package/aws-sdk) module installed
(or any other library that allows you to instantiate an S3 client with the `listBucketV2` method).

## Usage

This library works very well in conjunction with [`s3-list-bucket-stream`](https://www.npmjs.com/package/s3-list-bucket-stream), a library that allows you to create a readable stream to list files from an S3 bucket.

Here's a simple example that allows to output the content of objects
in an S3 bucket:

```javascript
const S3ListBucketStream = require('s3-list-bucket-stream')
const S3ObjectContentStream = require('s3-object-content-stream')

// create the S3 client
const AWS = require('aws-sdk')
const s3 = new AWS.S3()

// create the instance for the list bucket stream
const listBucketStream = new S3ListBucketStream(
  s3,
  'some-bucket',
  'path/to/files'
)

// create the instance for the object content stream
const objectContentStream = new S3ObjectContentStream(s3, 'some-bucket')

// pipe the two streams together and outputs on the stdout
listBucketStream.pipe(objectContentStream).pipe(process.stdout)
```

This will print the content of all the files in `some-bucket` with the prefix `path/to/files`.

Note that there will be no separator between different files.

## Content transformation

Most often your data in S3 will be in a compressed and/or encrypted form.

To deal with these cases, you can pass a factory function while instantiating a new `S3ObjectContentStream`.

This factory function has the goal of creating a new Transform stream that will be used to convert the data while it is emitted to the next phase of the pipeline.

The factory function receives the current chunk, so you can use that to do smart transformation based, for instance on the Object key (file name).

In this example we use this feature to automatically decompress gzipped files before emitting their content:

```javascript
const { createGunzip } = require('zlib')
const { extname } = require('path')
const { PassThrough } = require('stream')
const S3ListBucketStream = require('s3-list-bucket-stream')
const S3ObjectContentStream = require('s3-object-content-stream')

// definition of our factory function
const ungzipIfNeeded = key => {
  const extension = extname(key)
  if (['.gz', '.gzip'].includes(extension)) {
    return createGunzip() // if the file is gzip return a transform stream
  }

  // otherwise returns a passthrough stream (do not modify the content)
  return new PassThrough()
}

// create the S3 client
const AWS = require('aws-sdk')
const s3 = new AWS.S3()

// create the instance for the list bucket stream
const listBucketStream = new S3ListBucketStream(
  s3,
  'some-bucket',
  'path/to/files'
)

// create the instance for the object content stream
const objectContentStream = new S3ObjectContentStream(
  s3,
  'some-bucket',
  ungzipIfNeeded // pass our transform stream factory function
)

// pipe the two streams together and outputs on the stdout
listBucketStream.pipe(objectContentStream).pipe(process.stdout)
```

## Full metadata mode

If your readable source of S3 Objects emits objects (where for every element you have a property called `Key` that identifies the object name), you need to enable the `fullMetadata` flag for the stream to switch to object mode and read the object keys correctly.

This mode is useful when you want to operate to a level that is closer to what you get from the AWS SDK `ListObjectsV2` API where objects are identified as follows:

```plain
{ Key: 'path/to/files/file1',
  LastModified: 2019-02-08T11:11:19.000Z,
  ETag: '"7e97db1005fe07801a3e3737103ceab8"',
  Size: 49152,
  StorageClass: 'STANDARD' }
{ Key: 'path/to/files/file2',
  LastModified: 2019-02-07T11:11:19.000Z,
  ETag: '"6a97db1005fe07801a3e3737103ceab8"',
  Size: 39152,
  StorageClass: 'STANDARD' }
{ Key: 'path/to/files/file3',
  LastModified: 2019-02-05T11:11:19.000Z,
  ETag: '"b097db1005fe07801a3e3737103ceab8"',
  Size: 29152,
  StorageClass: 'STANDARD' }
...
```

In the following example we will use `S3ListBucketStream` in full metadata mode, hence we will need to enable full metadata even in our instance of `S3ObjectContentStream`:

```javascript
const S3ListBucketStream = require('s3-list-bucket-stream')
const S3ObjectContentStream = require('s3-object-content-stream')

// create the S3 client
const AWS = require('aws-sdk')
const s3 = new AWS.S3()

// create the instance for the list bucket stream
const listBucketStream = new S3ListBucketStream(
  s3,
  'some-bucket',
  'path/to/files',
  { fullMetadata: true } // full metadata enabled
)

// create the instance for the object content stream
const objectContentStream = new S3ObjectContentStream(
  s3,
  'some-bucket',
  undefined, // no transformation needed
  { fullMetadata: true } // full metadata enabled
)

// pipe the two streams together and outputs on the stdout
listBucketStream.pipe(objectContentStream).pipe(process.stdout)
```

## Contributing

Everyone is very welcome to contribute to this project. You can contribute just by submitting bugs or
suggesting improvements by [opening an issue on GitHub](https://github.com/lmammino/s3-object-content-stream/issues).

You can also submit PRs as long as you adhere with the code standards and write tests for the proposed changes.

## License

Licensed under [MIT License](LICENSE). © Luciano Mammino.
