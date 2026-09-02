import re

GST_TIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
PINCODE_REGEX = re.compile(r"^[0-9]{6}$")


def validate_gst_tin(value: str | None) -> None:
    if value and not GST_TIN_REGEX.match(value):
        raise ValueError("Invalid GST-TIN format")


def validate_ifsc(value: str | None) -> None:
    if value and not IFSC_REGEX.match(value):
        raise ValueError("Enter valid 11-character IFSC code.")


def validate_pincode(value: str) -> None:
    if not PINCODE_REGEX.match(value):
        raise ValueError("City & valid 6-digit Pincode required.")
