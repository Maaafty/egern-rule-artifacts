# Generated rule artifacts

This repository contains machine-generated rule resources for Egern, Loon, and
Mihomo-compatible clients, plus the native Egern `Bilibili Clean` module and
its script.

The stable Bilibili module is available at
`generated/Egern/Modules/Bilibili_Clean.yaml`. It removes advertising and
commercial UI from selected iOS app JSON and gRPC/protobuf responses and adds
navigation and Mine-page controls. The separate
`generated/Egern/Modules/Bilibili_Dynamic_Request_Experiment.yaml` module tests
request-side removal of the DynAll advertising parameter without modifying its
response. Neither module modifies membership state or unlocks paid features.
HTTPS decryption and the Egern CA certificate are required.

It intentionally contains no complete client profile, node subscription,
certificate, private key, bearer token, server address, or deployment
configuration. Files are replaced automatically; do not edit them by hand.
