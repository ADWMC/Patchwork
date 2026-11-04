# Local test-only TLS identity

The TLS key/cert pair is intentionally **not stored in Git**. Generate a local,
throwaway identity for the loopback transport tests:

```powershell
cd tests/fixtures/tls
openssl req -x509 -newkey rsa:2048 -nodes -keyout pinned.test.key.pem -out pinned.test.cert.pem -days 2 -subj /CN=pinned.test
```

These files are test-only, must never be trusted or reused outside tests, and are
excluded from both release packages. Without them, `tests/closure-network.test.mjs`
skips the TLS/proxy tests instead of failing.
