"use strict";

import dotenv from "dotenv";
dotenv.config();

import * as AWS from "aws-sdk";

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const upload = async (fileContent: string, bucketFolderPath: string) => {
  const s3 = new AWS.S3();

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Body: fileContent,
    Key: bucketFolderPath,
  };

  const result = await s3.upload(params).promise();
  if (!result) {
    return null;
  }

  return result.Location;
};

const empty = async (directory: string) => {
  const s3 = new AWS.S3();

  const listParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Prefix: directory,
  };

  const listedObjects = await s3.listObjectsV2(listParams).promise();

  if (listedObjects.Contents.length === 0) return;

  const deleteParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Delete: { Objects: [] },
  };

  listedObjects.Contents.forEach(({ Key }) => {
    deleteParams.Delete.Objects.push({ Key });
  });

  await s3.deleteObjects(deleteParams).promise();

  if (listedObjects.IsTruncated) await empty(directory);
};

export { upload, empty };
