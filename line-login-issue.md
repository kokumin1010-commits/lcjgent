# LINE Login Issue Analysis

## Problem
LINEアプリ内ブラウザでLINEログインを行うと、`code`パラメータが返されず、「認証情報が不足しています」エラーが発生する。

## Debug Info from User
```
URL: https://lcjmall.com/line-callback?state=-6P54MxKN-V1l8kUaVHqaPJySdlnsTAh&liffClientId=2009018493&liffRedirectUri=https%3A%2F%2Flcjmall.com%2Fline-callback
code: null
state: -6P54MxKN-V1l8kUaVHqaPJySdlnsTAh
error: null
```

## Root Cause
LINEアプリ内ブラウザ（LINE's in-app browser）では、通常のOAuth認可コードフローが正常に動作しない。
- `liffClientId` と `liffRedirectUri` パラメータが含まれている
- これはLINEがLIFF経由でリダイレクトしようとしていることを示す
- しかし、LIFFアプリとして設定されていないため、`code`が返されない

## Solution Options

### Option 1: LIFF SDK を使用する
- LIFF SDKをインストールして、`liff.login()` を使用
- LIFFアプリをLINE Developersコンソールで作成する必要がある
- LINEアプリ内ブラウザで完全に動作する

### Option 2: 外部ブラウザで開くように誘導
- LINEアプリ内ブラウザを検出
- 外部ブラウザ（Safari/Chrome）で開くように案内
- ユーザー体験が若干悪くなる

### Option 3: LIFF URL経由でアクセス
- LIFFアプリを作成し、LIFF URL（https://liff.line.me/xxx）経由でアクセス
- LIFFブラウザで開かれ、正常に動作する

## Recommended Solution
Option 1 (LIFF SDK) が最も良いユーザー体験を提供する。
