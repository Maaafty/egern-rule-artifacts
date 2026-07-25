# Generated rule artifacts

This repository contains machine-generated rule resources for Egern, Loon, and
Mihomo-compatible clients, plus the native Egern `Bilibili Clean` module and
its script.

The Bilibili module is available at
`generated/Egern/Modules/Bilibili_Clean.yaml`. It removes advertising and
commercial UI from the iOS app's JSON and gRPC/protobuf responses. It does not
modify membership state or unlock paid features. HTTPS decryption and the Egern
CA certificate are required.

It intentionally contains no complete client profile, node subscription,
certificate, private key, bearer token, server address, or deployment
configuration. Files are replaced automatically; do not edit them by hand.
