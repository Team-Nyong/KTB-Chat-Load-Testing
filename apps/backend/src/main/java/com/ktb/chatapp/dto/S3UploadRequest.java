package com.ktb.chatapp.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class S3UploadRequest {
    private String url;      // ex: https://ktbchat-s3-bucket.s3.ap-northeast-2.amazonaws.com/upload/chat/test.jpg
    private String mimetype;
    private long size;
}