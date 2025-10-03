from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))

        try:
            # Navigate to the running application
            page.goto("http://localhost:5173", timeout=90000)

            # Wait for the main app to render by checking for the header
            header = page.get_by_role("heading", name="Recognito")
            expect(header).to_be_visible(timeout=30000)

            # Check for the "System Active" status
            system_status = page.get_by_text("System Active")
            expect(system_status).to_be_visible()

            # Check that the "Detected Humans" section is there
            detected_humans_header = page.get_by_role("heading", name="Detected Humans")
            expect(detected_humans_header).to_be_visible()

            # The app should show the camera error state, which is expected
            error_message = page.get_by_text("Camera access denied")
            expect(error_message).to_be_visible()

            # Take a screenshot to verify the final UI state
            page.screenshot(path="jules-scratch/verification/detection_verification.png")

            print("Detection UI verification successful, screenshot saved.")

        except Exception as e:
            print(f"An error occurred during verification: {e}")
            page.screenshot(path="jules-scratch/verification/detection_verification_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run_verification()