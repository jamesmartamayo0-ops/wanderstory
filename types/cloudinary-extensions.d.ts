import "cloudinary";

declare module "cloudinary" {
  namespace v2 {
    namespace utils {
      function verify_api_response_signature(
        public_id: string,
        version: string | number,
        signature: string,
      ): boolean;
    }
  }
}
