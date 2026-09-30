"""Check that the website you built is byte-for-byte the same as the published one."""
import filecmp, os
root = os.path.dirname(os.path.abspath(__file__))
built = os.path.join(root, "prototype", "remoteconnect_nt.html")
ref = os.path.join(root, "reference", "published_website.html")
if not os.path.exists(built):
    raise SystemExit("Build the website first: python run_all.py")
print("Identical to the published website." if filecmp.cmp(built, ref, shallow=False)
      else "Different from the published website (expected only if you changed code or data).")
