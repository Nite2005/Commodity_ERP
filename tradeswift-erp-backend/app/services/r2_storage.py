import logging
import mimetypes
from typing import BinaryIO, Tuple
import boto3
from botocore.config import Config
from app.config import settings

logger = logging.getLogger(__name__)


class R2StorageService:
    _client = None

    @classmethod
    def is_enabled(cls) -> bool:
        return bool(
            settings.cloudflare_r2_endpoint_url
            and settings.cloudflare_r2_access_key_id
            and settings.cloudflare_r2_secret_access_key
            and settings.cloudflare_r2_bucket_name
        )

    @classmethod
    def get_client(cls):
        if cls._client is None and cls.is_enabled():
            cls._client = boto3.client(
                "s3",
                endpoint_url=settings.cloudflare_r2_endpoint_url,
                aws_access_key_id=settings.cloudflare_r2_access_key_id,
                aws_secret_access_key=settings.cloudflare_r2_secret_access_key,
                region_name="auto",
                config=Config(signature_version="s3v4"),
            )
        return cls._client

    @classmethod
    def upload_file(
        cls, file_obj: BinaryIO, key: str, content_type: str | None = None
    ) -> str:
        """Uploads a file object to Cloudflare R2 bucket."""
        client = cls.get_client()
        if not client:
            raise RuntimeError("Cloudflare R2 is not configured.")

        extra_args = {}
        if not content_type:
            content_type, _ = mimetypes.guess_type(key)
        if content_type:
            extra_args["ContentType"] = content_type

        file_obj.seek(0)
        client.upload_fileobj(
            Fileobj=file_obj,
            Bucket=settings.cloudflare_r2_bucket_name,
            Key=key,
            ExtraArgs=extra_args,
        )
        logger.info(f"Uploaded object to Cloudflare R2: {key}")
        return key

    @classmethod
    def get_file(cls, key: str) -> Tuple[BinaryIO, str, int]:
        """Fetches object body stream, content type, and content length from Cloudflare R2."""
        client = cls.get_client()
        if not client:
            raise RuntimeError("Cloudflare R2 is not configured.")

        resp = client.get_object(
            Bucket=settings.cloudflare_r2_bucket_name,
            Key=key,
        )
        content_type = resp.get("ContentType", "application/octet-stream")
        content_length = resp.get("ContentLength", 0)
        body = resp["Body"]
        return body, content_type, content_length

    @classmethod
    def delete_file(cls, key: str) -> bool:
        """Deletes object from Cloudflare R2 bucket."""
        client = cls.get_client()
        if not client:
            return False

        try:
            client.delete_object(
                Bucket=settings.cloudflare_r2_bucket_name,
                Key=key,
            )
            logger.info(f"Deleted object from Cloudflare R2: {key}")
            return True
        except Exception as e:
            logger.error(f"Error deleting object {key} from R2: {e}")
            return False

    @classmethod
    def get_presigned_url(cls, key: str, expires_in: int = 3600) -> str:
        """Generates a secure temporary presigned download URL."""
        client = cls.get_client()
        if not client:
            raise RuntimeError("Cloudflare R2 is not configured.")

        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.cloudflare_r2_bucket_name, "Key": key},
            ExpiresIn=expires_in,
        )
