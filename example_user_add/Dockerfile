FROM python:3.12-slim
WORKDIR /app
COPY app.py ./
ENV GREETING="esc bash default"
RUN useradd --create-home appuser
USER appuser

CMD ["python", "app.py"]                                                                                                         