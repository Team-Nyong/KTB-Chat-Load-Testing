package com.ktb.chatapp.dto;

import lombok.Builder;
import lombok.Data;


@Data
@Builder
public class S3FileResponse {
    private String id;
    private String url;
    private String originalFilename;
    private String mimetype;
    private long size;
}