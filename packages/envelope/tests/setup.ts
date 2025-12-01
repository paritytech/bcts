import sodium from "libsodium-wrappers";

// Initialize libsodium before all tests
beforeAll(async () => {
  await sodium.ready;
});
