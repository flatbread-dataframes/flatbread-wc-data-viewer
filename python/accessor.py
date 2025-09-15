import json
import uuid
from pathlib import Path

import pandas as pd
from jinja2 import Environment, FileSystemLoader


class ViewAccessor:
    def __init__(self, pandas_obj):
        self._obj = pandas_obj
        template_dir = Path(__file__).parent / "templates"
        self._jinja_env = Environment(loader=FileSystemLoader(template_dir))

    def _prepare_data(self) -> dict:
        """Convert pandas object to data-viewer format"""
        df = self._obj.to_frame() if isinstance(self._obj, pd.Series) else self._obj

        return {
            "values": [
                [None if pd.isna(cell) else cell for cell in row]
                for row in df.values.tolist()
            ],
            "columns": list(df.columns),
            "index": list(df.index),
            "columnNames": df.columns.names,
            "indexNames": df.index.names
        }

    def _repr_html_(self) -> str:
        """Render as HTML for Jupyter display"""
        try:
            data = self._prepare_data()
            viewer_id = f"viewer-{uuid.uuid4()}"

            def json_serializer(obj):
                if pd.isna(obj):
                    return None
                if hasattr(obj, 'isoformat'):
                    return obj.isoformat()
                return str(obj)

            template = self._jinja_env.get_template("viewer.jinja.html")
            return template.render(
                viewer_id=viewer_id,
                data=json.dumps(data, default=json_serializer)
            )
        except Exception as e:
            return f"<div style='color: red;'>Error rendering data viewer: {e}</div>"


# Register the accessor
pd.api.extensions.register_dataframe_accessor("viewer")(ViewAccessor)
pd.api.extensions.register_series_accessor("viewer")(ViewAccessor)
