# Blockchain Commons GSTP for TypeScript

> Disclaimer: This package is under active development and APIs may change.

## Introduction

Gordian Sealed Transaction Protocol (GSTP) is a secure, transport-agnostic communication method enabling encrypted and signed data exchange between multiple parties. Built upon the Gordian Envelope specification, GSTP supports various transport mediums—including HTTP, raw TCP/IP, air-gapped protocols using QR codes, and NFC cards—by implementing its own encryption and signing protocols.

A key feature of GSTP is Encrypted State Continuations (ESC), which embed encrypted state data directly into messages, eliminating the need for local state storage and enhancing security for devices with limited storage or requiring distributed state management. It facilitates both client-server and peer-to-peer architectures, ensuring secure and flexible communication across diverse platforms.

## Specification

- [BCR-2023-014: Gordian Sealed Transaction Protocol (GSTP)](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2023-014-gstp.md)

## Rust Reference Implementation

This TypeScript implementation is based on [gstp-rust](https://github.com/BlockchainCommons/gstp-rust) **v0.13.0** ([commit](https://github.com/BlockchainCommons/gstp-rust/tree/b2cfee1203b4e395ac5d58ac7a43ec226d56c187)).
