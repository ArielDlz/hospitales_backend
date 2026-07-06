import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export interface UploadResult {
  key: string;
  url: string;
}

@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-2');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID', '');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
      '',
    );

    this.client = new S3Client({
      region,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });

    this.bucket = this.configService.get<string>('S3_BUCKET', '');
    this.publicBaseUrl = this.configService
      .get<string>('S3_PUBLIC_BASE_URL', '')
      .replace(/\/$/, '');
  }

  async uploadBuffer(params: {
    buffer: Buffer;
    contentType: string;
    key: string;
  }): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType,
      }),
    );

    return {
      key: params.key,
      url: `${this.publicBaseUrl}/${params.key}`,
    };
  }
}
