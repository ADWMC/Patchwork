# Public test-only TLS identity

`pinned.test.cert.pem` and its matching key are a deliberately public, self-signed
identity for ephemeral loopback transport tests. They are not service credentials
and must never be trusted or reused outside these tests. The production transport
still verifies certificate names and trust; tests supply this certificate only to
their child process via NODE_EXTRA_CA_CERTS / CURL_CA_BUNDLE. No system trust store
is changed. These fixtures are excluded from both release packages.
